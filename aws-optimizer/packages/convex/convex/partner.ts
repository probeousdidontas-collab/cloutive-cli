/**
 * Partner Management
 *
 * Implements US-039: Implement partner - client organization creation
 *
 * Features:
 * - Create client organizations with partner as admin
 * - Create invitations for client primary contacts
 * - Client becomes owner when accepting invitation
 * - List client organizations with summary stats
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Generate a URL-friendly slug from a name.
 */
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  // Add a timestamp suffix to ensure uniqueness
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

/**
 * Create a client organization.
 * Partner is added as admin, and an invitation is created for the client.
 * Client becomes owner when they accept the invitation.
 */
export const createClientOrganization = mutation({
  args: {
    partnerId: v.id("users"),
    organizationName: v.string(),
    clientEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { partnerId, organizationName, clientEmail } = args;
    const now = Date.now();

    // Validate inputs
    if (!organizationName.trim()) {
      throw new Error("Organization name is required");
    }
    if (!clientEmail.trim()) {
      throw new Error("Client email is required");
    }

    // Verify partner exists
    const partner = await ctx.db.get(partnerId);
    if (!partner) {
      throw new Error("Partner user not found");
    }

    // Generate a unique slug
    const slug = generateSlug(organizationName);

    // Create the organization
    const organizationId = await ctx.db.insert("organizations", {
      name: organizationName.trim(),
      slug,
      plan: "free",
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

    // Add partner as admin
    await ctx.db.insert("orgMembers", {
      organizationId,
      userId: partnerId,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // Create invitation for the client (who will become owner)
    const invitationId = await ctx.db.insert("orgInvitations", {
      organizationId,
      email: clientEmail.trim().toLowerCase(),
      role: "owner",
      status: "pending",
      invitedBy: partnerId,
      createdAt: now,
      updatedAt: now,
    });

    // TODO: Send invite email via Resend component
    // This would be done via an action that calls the Resend API
    // For now, we just create the invitation record

    return {
      organizationId,
      invitationId,
    };
  },
});

/**
 * List client organizations for a partner.
 * Returns organizations where the partner is an admin with summary stats.
 */
export const listClientOrganizations = query({
  args: {
    partnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { partnerId } = args;

    // Get all memberships where user is admin (partner-created orgs)
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", partnerId))
      .collect();

    // Filter to only admin memberships (partner-created)
    const adminMemberships = memberships.filter((m) => m.role === "admin");

    // Fetch organizations and compute stats
    const organizations = await Promise.all(
      adminMemberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        if (!org) return null;

        // Get AWS accounts for this org
        const awsAccounts = await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
          .collect();

        // Get alerts for this org
        const alerts = await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
          .collect();

        // Calculate total cost from cost snapshots (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

        let totalCost = 0;
        for (const account of awsAccounts) {
          const snapshots = await ctx.db
            .query("costSnapshots")
            .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
            .collect();

          const recentSnapshots = snapshots.filter((s) => s.date >= thirtyDaysAgoStr);
          totalCost += recentSnapshots.reduce((sum, s) => sum + s.totalCost, 0);
        }

        // Count unacknowledged alerts
        const activeAlerts = alerts.filter((a) => !a.acknowledgedAt);

        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          settings: org.settings,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          totalCost,
          accountCount: awsAccounts.length,
          alertCount: activeAlerts.length,
        };
      })
    );

    // Filter out nulls (deleted organizations)
    return organizations.filter((org): org is NonNullable<typeof org> => org !== null);
  },
});

/**
 * Accept an invitation to join an organization.
 * The user becomes the role specified in the invitation (owner for client orgs).
 */
export const acceptInvitation = mutation({
  args: {
    invitationId: v.id("orgInvitations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { invitationId, userId } = args;
    const now = Date.now();

    // Get the invitation
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      throw new Error("Invitation has already been accepted");
    }

    // Verify the user's email matches the invitation
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Email does not match invitation");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", userId)
      )
      .first();

    if (existingMembership) {
      throw new Error("User is already a member of this organization");
    }

    // Create the membership with the invited role
    const membershipId = await ctx.db.insert("orgMembers", {
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      createdAt: now,
      updatedAt: now,
    });

    // Mark invitation as accepted
    await ctx.db.patch(invitationId, {
      status: "accepted",
      acceptedAt: now,
      updatedAt: now,
    });

    return { membershipId };
  },
});
