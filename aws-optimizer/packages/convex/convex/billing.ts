/**
 * Billing Management
 *
 * Features:
 * - Get subscription information
 * - Get usage statistics
 * - Get invoice history
 * - Create Stripe portal session
 */

import { mutation, query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

/**
 * Get subscription information for the user's organization.
 */
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      return null;
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    if (!subscription) {
      // Return a default free subscription if none exists
      return {
        _id: "free",
        plan: "free",
        status: "active",
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        features: {
          maxAccounts: 1,
          maxAnalysisRuns: 10,
          supportLevel: "community",
        },
      };
    }

    // Map plan ID to plan name and features
    const planFeatures: Record<string, { maxAccounts: number; maxAnalysisRuns: number; supportLevel: string }> = {
      free: { maxAccounts: 1, maxAnalysisRuns: 10, supportLevel: "community" },
      starter: { maxAccounts: 5, maxAnalysisRuns: 50, supportLevel: "email" },
      professional: { maxAccounts: 20, maxAnalysisRuns: 200, supportLevel: "priority" },
      enterprise: { maxAccounts: -1, maxAnalysisRuns: -1, supportLevel: "dedicated" },
    };

    return {
      _id: subscription._id,
      plan: subscription.planId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: planFeatures[subscription.planId] || planFeatures.free,
    };
  },
});

/**
 * Get usage statistics for the current billing period.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      return null;
    }

    // Get current billing period (last 30 days for simplicity)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get usage records for this period
    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const periodRecords = usageRecords.filter(
      (r) => r.createdAt >= thirtyDaysAgo
    );

    // Count analysis runs
    const analysisRuns = periodRecords
      .filter((r) => r.type === "analysis_run")
      .reduce((sum, r) => sum + r.quantity, 0);

    // Count API calls
    const apiCalls = periodRecords
      .filter((r) => r.type === "api_call")
      .reduce((sum, r) => sum + r.quantity, 0);

    // Get AWS account count
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return {
      billingPeriodStart: thirtyDaysAgo,
      billingPeriodEnd: now,
      analysisRuns,
      apiCalls,
      connectedAccounts: awsAccounts.length,
    };
  },
});

/**
 * Get invoice history.
 * Note: In a real implementation, this would fetch from Stripe.
 */
export const getInvoices = query({
  args: {},
  handler: async (_ctx) => {
    // In a real implementation, this would fetch invoices from Stripe
    // For now, return an empty array
    return [];
  },
});

/**
 * Create a Stripe portal session for managing subscription.
 */
export const createPortalSession = mutation({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("No organization found");
    }

    // In a real implementation, this would call Stripe to create a portal session
    // For now, return a placeholder
    // organizationId will be used when integrating with Stripe
    void organizationId;
    return {
      url: "https://billing.stripe.com/session/placeholder",
    };
  },
});
