/**
 * Auth Helpers
 *
 * Shared authentication utility functions for Convex backend modules.
 * Provides consistent user/organization authentication across all modules.
 */

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { safeGetAuthUser } from "./auth";

/**
 * Get organization ID from the authenticated user's memberships.
 * Uses safeGetAuthUser to properly authenticate the user.
 *
 * @param ctx - Convex query or mutation context
 * @returns The user's organization ID, or null if not authenticated or no membership
 */
export async function getUserOrgId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"organizations"> | null> {
  const user = await safeGetAuthUser(ctx);
  if (!user) {
    return null;
  }

  // Find the user's organization membership
  // Note: Better Auth returns Id<"user"> (singular) but schema uses Id<"users"> (plural)
  const userId = user._id as unknown as Id<"users">;
  const membership = await ctx.db
    .query("orgMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  return membership?.organizationId ?? null;
}

/**
 * Require organization ID from the authenticated user.
 * Throws an error if the user is not authenticated or has no organization.
 *
 * @param ctx - Convex query or mutation context
 * @returns The user's organization ID
 * @throws Error if not authenticated or no organization membership
 */
export async function requireUserOrgId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"organizations">> {
  const organizationId = await getUserOrgId(ctx);
  if (!organizationId) {
    throw new Error("Not authenticated or no organization membership");
  }
  return organizationId;
}
