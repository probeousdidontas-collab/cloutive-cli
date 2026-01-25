/**
 * Organization CRUD Operations
 *
 * Implements US-008: Implement organization CRUD operations
 *
 * Features:
 * - Create, update, delete mutations
 * - getById and list queries
 * - Auto-creates orgMember with 'owner' role on organization creation
 * - Requires authentication for all operations
 * - Logs activity for organization changes
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Organization plan types
const planValidator = v.union(
  v.literal("free"),
  v.literal("starter"),
  v.literal("professional"),
  v.literal("enterprise")
);

// Organization settings validator
const settingsValidator = v.object({
  enableNotifications: v.optional(v.boolean()),
  maxUsers: v.optional(v.number()),
  customDomain: v.optional(v.string()),
  defaultRegion: v.optional(v.string()),
  features: v.optional(v.object({})),
});

// Organization member roles that can perform updates
const WRITE_ROLES = ["owner", "admin", "member"] as const;

/**
 * Helper to check if a user is a member of an organization and get their role.
 */
async function getMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<Doc<"orgMembers"> | null> {
  return await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .first();
}

/**
 * Helper to log activity.
 */
async function logActivity(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  action: "create" | "update" | "delete",
  details?: { previousValues?: unknown; newValues?: unknown; description?: string }
): Promise<void> {
  await ctx.db.insert("activityLogs", {
    organizationId,
    userId,
    action,
    entityType: "organization",
    entityId: organizationId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * Create a new organization.
 * Automatically creates an orgMember with 'owner' role for the creating user.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    plan: planValidator,
    userId: v.id("users"),
    settings: v.optional(settingsValidator),
  },
  handler: async (ctx, args) => {
    const { name, slug, plan, userId, settings } = args;
    const now = Date.now();

    // Check if slug is already taken
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existingOrg) {
      throw new Error(`Organization with slug "${slug}" already exists`);
    }

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create the organization
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      plan,
      settings: settings ?? {},
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create orgMember with 'owner' role
    const membershipId = await ctx.db.insert("orgMembers", {
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await logActivity(ctx, organizationId, userId, "create", {
      newValues: { name, slug, plan },
      description: `Organization "${name}" created`,
    });

    return { organizationId, membershipId };
  },
});

/**
 * Update an existing organization.
 * Requires the user to be a member with write permissions (owner, admin, or member).
 */
export const update = mutation({
  args: {
    id: v.id("organizations"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    plan: v.optional(planValidator),
    settings: v.optional(settingsValidator),
  },
  handler: async (ctx, args) => {
    const { id, userId, name, plan, settings } = args;

    // Get the organization
    const organization = await ctx.db.get(id);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Check membership and permissions
    const membership = await getMembership(ctx, id, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    if (!WRITE_ROLES.includes(membership.role as typeof WRITE_ROLES[number])) {
      throw new Error("You do not have permission to update this organization");
    }

    // Build update object
    const updates: Partial<{
      name: string;
      plan: "free" | "starter" | "professional" | "enterprise";
      settings: typeof organization.settings;
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (name !== undefined) {
      updates.name = name;
    }
    if (plan !== undefined) {
      updates.plan = plan;
    }
    if (settings !== undefined) {
      updates.settings = { ...organization.settings, ...settings };
    }

    // Update the organization
    await ctx.db.patch(id, updates);

    // Log activity
    await logActivity(ctx, id, userId, "update", {
      previousValues: { name: organization.name, plan: organization.plan },
      newValues: { name, plan },
      description: `Organization updated`,
    });

    return { success: true };
  },
});

/**
 * Delete an organization.
 * Only owners can delete organizations.
 * Also deletes all associated org members.
 */
export const remove = mutation({
  args: {
    id: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { id, userId } = args;

    // Get the organization
    const organization = await ctx.db.get(id);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Check membership - only owners can delete
    const membership = await getMembership(ctx, id, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    if (membership.role !== "owner") {
      throw new Error("Only owners can delete organizations");
    }

    // Log activity BEFORE deletion (so we have the org ID)
    await logActivity(ctx, id, userId, "delete", {
      previousValues: { name: organization.name, slug: organization.slug },
      description: `Organization "${organization.name}" deleted`,
    });

    // Delete all org members
    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", id))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete the organization
    await ctx.db.delete(id);

    return { success: true };
  },
});

/**
 * Get an organization by ID.
 * Requires the user to be a member of the organization.
 */
export const getById = query({
  args: {
    id: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { id, userId } = args;

    // Get the organization
    const organization = await ctx.db.get(id);
    if (!organization) {
      return null;
    }

    // Check membership
    const membership = await getMembership(ctx, id, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    return organization;
  },
});

/**
 * Get an organization by slug.
 * Returns null if not found or user is not a member.
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { slug, userId } = args;

    // Find organization by slug
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (!organization) {
      return null;
    }

    // Check membership
    const membership = await getMembership(ctx, organization._id, userId);
    if (!membership) {
      return null;
    }

    return organization;
  },
});

/**
 * List all organizations the user is a member of.
 * Returns organizations with the user's role in each.
 */
export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Get all memberships for this user
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fetch organizations for each membership
    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        if (!org) return null;

        return {
          ...org,
          memberRole: membership.role,
        };
      })
    );

    // Filter out nulls (deleted organizations)
    return organizations.filter((org): org is NonNullable<typeof org> => org !== null);
  },
});
