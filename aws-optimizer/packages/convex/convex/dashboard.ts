/**
 * Dashboard Queries
 *
 * Implements US-024: Implement cost dashboard page
 *
 * Features:
 * - Get cost snapshots for an organization (aggregated across accounts)
 * - Get top recommendations with estimated savings
 * - Get cost breakdown by service
 * - Get cost trend over time
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Helper to get a user's membership in an organization.
 */
async function getMembership(
  ctx: QueryCtx,
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
 * Get all AWS accounts for an organization.
 */
async function getOrgAwsAccounts(
  ctx: QueryCtx,
  organizationId: Id<"organizations">
): Promise<Doc<"awsAccounts">[]> {
  return await ctx.db
    .query("awsAccounts")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
}

/**
 * Get cost snapshots for dashboard.
 * Returns snapshots from all AWS accounts in the organization.
 */
export const getCostSnapshots = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    startDate: v.optional(v.string()), // YYYY-MM-DD format
    endDate: v.optional(v.string()),   // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, startDate, endDate } = args;

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all cost snapshots for these accounts
    const allSnapshots: Doc<"costSnapshots">[] = [];
    
    for (const awsAccountId of awsAccountIds) {
      const snapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();
      
      allSnapshots.push(...snapshots);
    }

    // Filter by date range if provided
    let filteredSnapshots = allSnapshots;
    
    if (startDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.date >= startDate);
    }
    
    if (endDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.date <= endDate);
    }

    // Sort by date
    filteredSnapshots.sort((a, b) => a.date.localeCompare(b.date));

    return filteredSnapshots;
  },
});

/**
 * Get top recommendations for dashboard.
 * Returns open recommendations sorted by estimated savings, limited to top N.
 */
export const getTopRecommendations = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, limit = 5 } = args;

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all recommendations for these accounts
    const allRecommendations: Doc<"recommendations">[] = [];
    
    for (const awsAccountId of awsAccountIds) {
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();
      
      allRecommendations.push(...recommendations);
    }

    // Filter to only open recommendations
    const openRecommendations = allRecommendations.filter(
      (r) => r.status === "open"
    );

    // Sort by estimated savings (descending) and limit
    const topRecommendations = openRecommendations
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
      .slice(0, limit);

    return topRecommendations;
  },
});

/**
 * Get dashboard summary data.
 * Returns aggregated cost data and statistics.
 */
export const getDashboardSummary = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = args;

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const activeAccounts = awsAccounts.filter((a) => a.status === "active");

    // Get date ranges for current and previous month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const currentMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
    
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
    const prevMonthEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-31`;

    // Collect all snapshots and recommendations
    let currentMonthCost = 0;
    let previousMonthCost = 0;
    const serviceBreakdown: Record<string, number> = {};
    let totalOpenRecommendations = 0;
    let totalEstimatedSavings = 0;

    for (const account of awsAccounts) {
      // Get snapshots for this account
      const snapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      // Calculate current month total
      for (const snapshot of snapshots) {
        if (snapshot.date >= currentMonthStart && snapshot.date <= currentMonthEnd) {
          currentMonthCost += snapshot.totalCost;
          
          // Aggregate service breakdown
          if (snapshot.serviceBreakdown) {
            for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
              serviceBreakdown[service] = (serviceBreakdown[service] || 0) + cost;
            }
          }
        }
        
        // Calculate previous month total
        if (snapshot.date >= prevMonthStart && snapshot.date <= prevMonthEnd) {
          previousMonthCost += snapshot.totalCost;
        }
      }

      // Get recommendations for this account
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      const openRecs = recommendations.filter((r) => r.status === "open");
      totalOpenRecommendations += openRecs.length;
      totalEstimatedSavings += openRecs.reduce((sum, r) => sum + r.estimatedSavings, 0);
    }

    // Calculate month-over-month change
    const costChange = previousMonthCost > 0
      ? ((currentMonthCost - previousMonthCost) / previousMonthCost) * 100
      : 0;

    return {
      totalAccounts: awsAccounts.length,
      activeAccounts: activeAccounts.length,
      currentMonthCost,
      previousMonthCost,
      costChange,
      serviceBreakdown,
      totalOpenRecommendations,
      totalEstimatedSavings,
    };
  },
});
