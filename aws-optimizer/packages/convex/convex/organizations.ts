/**
 * Organization Management
 *
 * Handles mapping between Better Auth organizations and Convex organizations.
 * Better Auth manages authentication and has its own organization system,
 * while Convex stores application-specific organization data.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Get or create a Convex organization from a Better Auth organization ID.
 * 
 * This function handles the mapping between Better Auth's organization system
 * and Convex's organization table. If a Convex organization with the given
 * Better Auth ID already exists, it returns that. Otherwise, it creates a new one.
 * 
 * @param betterAuthOrgId - The organization ID from Better Auth
 * @param name - The organization name (used when creating a new org)
 * @param slug - The organization slug (used when creating a new org)
 * @returns The Convex organization ID
 */
export const getOrCreateByBetterAuthId = mutation({
  args: {
    betterAuthOrgId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const { betterAuthOrgId, name, slug } = args;
    const now = Date.now();

    // First, try to find existing organization by Better Auth ID
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_betterAuthOrgId", (q) => q.eq("betterAuthOrgId", betterAuthOrgId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Generate slug if not provided
    const orgSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if slug already exists and make unique if needed
    let finalSlug = orgSlug;
    let slugCounter = 1;
    while (true) {
      const existingSlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();
      if (!existingSlug) break;
      finalSlug = `${orgSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Create new organization
    const orgId = await ctx.db.insert("organizations", {
      name,
      slug: finalSlug,
      betterAuthOrgId,
      plan: "free",
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

    return orgId;
  },
});

/**
 * Get a Convex organization ID by Better Auth organization ID.
 * Returns null if no mapping exists.
 */
export const getByBetterAuthId = query({
  args: {
    betterAuthOrgId: v.string(),
  },
  returns: v.union(v.id("organizations"), v.null()),
  handler: async (ctx, args) => {
    const { betterAuthOrgId } = args;

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_betterAuthOrgId", (q) => q.eq("betterAuthOrgId", betterAuthOrgId))
      .first();

    return org?._id ?? null;
  },
});

/**
 * Get organization details by ID.
 */
export const getById = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});
