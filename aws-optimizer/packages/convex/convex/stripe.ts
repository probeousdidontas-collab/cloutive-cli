/**
 * Stripe Billing Integration
 *
 * US-032: Set up Stripe billing integration
 *
 * Features:
 * - Plan tier definitions (Free, Pro, Enterprise)
 * - Customer and subscription management
 * - Usage-based pricing for AI analysis runs
 * - Webhook handlers for subscription events
 *
 * The @convex-dev/stripe component handles webhook verification automatically.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ============================================================================
// Plan Tier Definitions
// ============================================================================

/**
 * Plan tier type - maps to Stripe price IDs
 * Note: Aligns with schema planValidator (free, starter, professional, enterprise)
 * - free = Free tier
 * - starter/professional = Pro tier (mapped together for simplicity)
 * - enterprise = Enterprise tier
 */
export type PlanTier = "free" | "starter" | "professional" | "enterprise";

/**
 * Plan tier configuration
 */
export interface PlanTierConfig {
  name: string;
  priceId: string | null; // null for free tier
  maxAwsAccounts: number; // -1 for unlimited
  includedAnalysisRuns: number; // -1 for unlimited
  overagePrice: number; // price per additional analysis run in dollars
  features: string[];
}

/**
 * Plan tier definitions
 * 
 * Free: 1 AWS account, 5 analysis runs/month
 * Pro: 5 AWS accounts, 100 analysis runs/month, $0.25/overage
 * Enterprise: Unlimited accounts and runs
 */
export const PLAN_TIERS: Record<PlanTier, PlanTierConfig> = {
  free: {
    name: "Free",
    priceId: null,
    maxAwsAccounts: 1,
    includedAnalysisRuns: 5,
    overagePrice: 0.50, // $0.50 per additional run
    features: [
      "1 AWS account",
      "5 AI analysis runs/month",
      "Basic cost dashboard",
      "Email support",
    ],
  },
  starter: {
    name: "Starter",
    priceId: "price_starter_monthly", // Replace with actual Stripe price ID
    maxAwsAccounts: 3,
    includedAnalysisRuns: 50,
    overagePrice: 0.35, // $0.35 per additional run
    features: [
      "3 AWS accounts",
      "50 AI analysis runs/month",
      "Cost dashboard",
      "Basic recommendations",
      "Email support",
    ],
  },
  professional: {
    name: "Professional",
    priceId: "price_professional_monthly", // Replace with actual Stripe price ID
    maxAwsAccounts: 5,
    includedAnalysisRuns: 100,
    overagePrice: 0.25, // $0.25 per additional run
    features: [
      "5 AWS accounts",
      "100 AI analysis runs/month",
      "Advanced cost analytics",
      "Recommendation engine",
      "Priority support",
      "API access",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceId: "price_enterprise_monthly", // Replace with actual Stripe price ID
    maxAwsAccounts: -1, // unlimited
    includedAnalysisRuns: -1, // unlimited
    overagePrice: 0,
    features: [
      "Unlimited AWS accounts",
      "Unlimited AI analysis runs",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantees",
      "SSO/SAML",
      "Audit logs",
    ],
  },
};

// ============================================================================
// Plan Limit Utilities
// ============================================================================

/**
 * Get the limits for a given plan tier.
 */
export function getPlanLimits(plan: PlanTier): {
  maxAwsAccounts: number;
  includedAnalysisRuns: number;
  overagePrice: number;
} {
  const tier = PLAN_TIERS[plan] || PLAN_TIERS.free;
  return {
    maxAwsAccounts: tier.maxAwsAccounts,
    includedAnalysisRuns: tier.includedAnalysisRuns,
    overagePrice: tier.overagePrice,
  };
}

/**
 * Check if an organization can add another AWS account based on their plan.
 */
export function canAddAwsAccount(plan: PlanTier, currentAccountCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (limits.maxAwsAccounts === -1) return true; // unlimited
  return currentAccountCount < limits.maxAwsAccounts;
}

/**
 * Get the price for an analysis run based on usage.
 * Returns 0 if within included limit, otherwise returns overage price.
 */
export function getUsagePricePerRun(plan: PlanTier, currentRunCount: number): number {
  const limits = getPlanLimits(plan);
  if (limits.includedAnalysisRuns === -1) return 0; // unlimited
  if (currentRunCount <= limits.includedAnalysisRuns) return 0; // within limit
  return limits.overagePrice;
}

// ============================================================================
// Subscription Queries
// ============================================================================

/**
 * Get the active subscription for an organization.
 */
export const getSubscriptionByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

/**
 * Get subscription by Stripe customer ID.
 */
export const getSubscriptionByCustomerId = query({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
  },
});

/**
 * Check if organization has an active paid subscription.
 */
export const hasActiveSubscription = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return subscription !== null;
  },
});

// ============================================================================
// Subscription Mutations
// ============================================================================

/**
 * Create or update a subscription for an organization.
 * Called by webhook handlers when subscription events occur.
 */
export const upsertSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stripeCustomerId: v.string(),
    planId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("incomplete")
    ),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        planId: args.planId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new subscription
      return await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        stripeCustomerId: args.stripeCustomerId,
        planId: args.planId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Cancel a subscription.
 */
export const cancelSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: "canceled",
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update subscription status (e.g., for past_due, incomplete).
 */
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("incomplete")
    ),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: args.status,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Record an analysis run for usage-based billing.
 */
export const recordAnalysisRun = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get current billing period (simplified: current month)
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(1);
    billingPeriodStart.setHours(0, 0, 0, 0);

    const billingPeriodEnd = new Date(billingPeriodStart);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    return await ctx.db.insert("usageRecords", {
      organizationId: args.organizationId,
      type: "analysis_run",
      quantity: 1,
      billingPeriodStart: billingPeriodStart.getTime(),
      billingPeriodEnd: billingPeriodEnd.getTime(),
      createdAt: now,
    });
  },
});

/**
 * Get usage summary for an organization in the current billing period.
 */
export const getUsageSummary = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Get current billing period
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(1);
    billingPeriodStart.setHours(0, 0, 0, 0);

    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.gte(q.field("createdAt"), billingPeriodStart.getTime()))
      .collect();

    const analysisRuns = usageRecords
      .filter((r) => r.type === "analysis_run")
      .reduce((sum, r) => sum + r.quantity, 0);

    // Get organization's plan to calculate overage
    const org = await ctx.db.get(args.organizationId);
    const plan = (org?.plan || "free") as PlanTier;
    const limits = getPlanLimits(plan);

    const includedRuns = limits.includedAnalysisRuns === -1 ? Infinity : limits.includedAnalysisRuns;
    const overageRuns = Math.max(0, analysisRuns - includedRuns);
    const overageCost = overageRuns * limits.overagePrice;

    return {
      analysisRuns,
      includedRuns: limits.includedAnalysisRuns,
      overageRuns,
      overageCost,
      billingPeriodStart: billingPeriodStart.getTime(),
    };
  },
});

/**
 * Check if organization can perform another analysis run.
 * For free tier, this enforces the limit. For paid tiers, it always allows
 * but tracks for billing purposes.
 */
export const canPerformAnalysisRun = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return { allowed: false, reason: "Organization not found" };

    const plan = org.plan as PlanTier;

    // Enterprise always allowed
    if (plan === "enterprise") {
      return { allowed: true, reason: null };
    }

    // Check if they have an active subscription for paid plans
    if (plan !== "free") {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();

      if (subscription) {
        return { allowed: true, reason: null }; // Paid plans can always run (will be billed)
      }
    }

    // For free tier or inactive subscriptions, check usage limits
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(1);
    billingPeriodStart.setHours(0, 0, 0, 0);

    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.gte(q.field("createdAt"), billingPeriodStart.getTime()))
      .collect();

    const currentRuns = usageRecords
      .filter((r) => r.type === "analysis_run")
      .reduce((sum, r) => sum + r.quantity, 0);

    const limits = getPlanLimits(plan);
    if (currentRuns >= limits.includedAnalysisRuns) {
      return {
        allowed: false,
        reason: `You've reached your limit of ${limits.includedAnalysisRuns} analysis runs for this month. Upgrade to Pro for more runs.`,
      };
    }

    return { allowed: true, reason: null };
  },
});

// ============================================================================
// Customer Portal
// ============================================================================

/**
 * Get billing information for display in the UI.
 */
export const getBillingInfo = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const plan = (org.plan || "free") as PlanTier;
    const planConfig = PLAN_TIERS[plan] || PLAN_TIERS.free;

    // Get AWS account count
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Get usage summary
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(1);
    billingPeriodStart.setHours(0, 0, 0, 0);

    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.gte(q.field("createdAt"), billingPeriodStart.getTime()))
      .collect();

    const analysisRuns = usageRecords
      .filter((r) => r.type === "analysis_run")
      .reduce((sum, r) => sum + r.quantity, 0);

    return {
      plan,
      planName: planConfig.name,
      features: planConfig.features,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            stripeCustomerId: subscription.stripeCustomerId,
          }
        : null,
      limits: {
        maxAwsAccounts: planConfig.maxAwsAccounts,
        currentAwsAccounts: awsAccounts.length,
        includedAnalysisRuns: planConfig.includedAnalysisRuns,
        currentAnalysisRuns: analysisRuns,
      },
      canAddAwsAccount: canAddAwsAccount(plan, awsAccounts.length),
    };
  },
});
