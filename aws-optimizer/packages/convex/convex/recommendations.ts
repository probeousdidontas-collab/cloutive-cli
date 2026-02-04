/**
 * Recommendations Management
 *
 * Features:
 * - List recommendations for an organization
 * - Update recommendation status (implement, dismiss)
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

// Recommendation status validator
const recommendationStatusValidator = v.union(
  v.literal("open"),
  v.literal("implemented"),
  v.literal("dismissed"),
  v.literal("in_progress")
);

/**
 * List all recommendations for the user's organization.
 * Accepts optional organizationId for multi-org support.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Use provided organizationId or fall back to auth context
    const organizationId = args.organizationId ?? await getUserOrgId(ctx);
    if (!organizationId) {
      return [];
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all recommendations for these accounts
    const allRecommendations = [];

    for (const awsAccountId of awsAccountIds) {
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();

      allRecommendations.push(...recommendations);
    }

    // Sort by estimated savings descending
    allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

    return allRecommendations;
  },
});

/**
 * Update the status of a recommendation.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("recommendations"),
    status: recommendationStatusValidator,
  },
  handler: async (ctx, args) => {
    // Get the user's organization
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("Not authenticated");
    }

    const recommendation = await ctx.db.get(args.id);
    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    // Get the AWS account to verify organization ownership
    const awsAccount = await ctx.db.get(recommendation.awsAccountId);
    if (!awsAccount || awsAccount.organizationId !== organizationId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
