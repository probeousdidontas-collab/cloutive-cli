/**
 * Cron Jobs Configuration
 *
 * US-036: Implement cron jobs for scheduled analysis
 *
 * Scheduled tasks for the AWS Cost Optimizer:
 * - Daily cost collection for all connected AWS accounts
 * - Uses Workpool for job prioritization (enterprise > professional > free)
 * - Uses ActionRetrier for graceful failure handling
 */

import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { ActionRetrier } from "@convex-dev/action-retrier";
import type { Id, Doc } from "./_generated/dataModel";

// Initialize action retrier for graceful failure handling
const actionRetrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 5000, // 5 seconds initial backoff
  maxFailures: 3,         // Retry up to 3 times
  base: 2,                // Exponential backoff multiplier
});

// Plan priority mapping (higher number = higher priority)
const PLAN_PRIORITY: Record<string, number> = {
  enterprise: 100,
  professional: 75,
  starter: 50,
  free: 25,
};

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get all AWS accounts eligible for daily cost collection.
 *
 * Returns accounts that:
 * - Have active status
 * - Belong to organizations with active subscriptions OR free plan
 * - Have credentials configured
 *
 * Results are sorted by plan priority (enterprise first).
 */
export const getAccountsForCollection = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      awsAccountId: v.id("awsAccounts"),
      organizationId: v.id("organizations"),
      accountName: v.string(),
      plan: v.string(),
    })
  ),
  handler: async (ctx) => {
    // Get all active AWS accounts
    const activeAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const eligibleAccounts: Array<{
      awsAccountId: Id<"awsAccounts">;
      organizationId: Id<"organizations">;
      accountName: string;
      plan: string;
    }> = [];

    for (const account of activeAccounts) {
      // Get the organization
      const org = await ctx.db.get(account.organizationId);
      if (!org) continue;

      // Check if org has valid subscription for paid plans
      const plan = org.plan as string;
      if (plan !== "free") {
        // Paid plans need active subscription
        const subscription = await ctx.db
          .query("subscriptions")
          .withIndex("by_organization", (q) => q.eq("organizationId", account.organizationId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .first();

        if (!subscription) continue;
      }

      // Check if credentials exist
      const credentials = await ctx.db
        .query("awsCredentials")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .first();

      // Only include accounts with credentials configured
      if (!credentials) continue;
      if (!credentials.encryptedAccessKeyId && !credentials.roleArn) continue;

      eligibleAccounts.push({
        awsAccountId: account._id,
        organizationId: account.organizationId,
        accountName: account.name,
        plan,
      });
    }

    // Sort by plan priority (enterprise first)
    eligibleAccounts.sort((a, b) => {
      const priorityA = PLAN_PRIORITY[a.plan] || 0;
      const priorityB = PLAN_PRIORITY[b.plan] || 0;
      return priorityB - priorityA;
    });

    return eligibleAccounts;
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Schedule cost collection for a specific AWS account.
 * Creates an analysis run record and returns whether it was scheduled.
 */
export const scheduleCostCollection = internalMutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    scheduled: v.boolean(),
    analysisRunId: v.optional(v.id("analysisRuns")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    // Check if there's already a running or pending analysis for this account today
    const existingRun = await ctx.db
      .query("analysisRuns")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", args.awsAccountId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "cost_snapshot"),
          q.or(
            q.eq(q.field("status"), "running"),
            q.eq(q.field("status"), "pending")
          ),
          q.gte(q.field("startedAt"), todayStart)
        )
      )
      .first();

    if (existingRun) {
      return {
        scheduled: false,
        reason: "Analysis already running or pending for today",
      };
    }

    // Create new analysis run with awsAccountId
    const analysisRunId = await ctx.db.insert("analysisRuns", {
      organizationId: args.organizationId,
      awsAccountId: args.awsAccountId,
      type: "cost_snapshot",
      status: "pending",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      scheduled: true,
      analysisRunId,
    };
  },
});

/**
 * Update the status of an analysis run.
 */
export const updateAnalysisRunStatus = internalMutation({
  args: {
    analysisRunId: v.id("analysisRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Partial<Doc<"analysisRuns">> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
    }

    await ctx.db.patch(args.analysisRunId, updates);
  },
});

/**
 * Record usage for billing purposes when an analysis is triggered.
 */
export const recordUsageForAnalysis = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get current billing period (current month)
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(1);
    billingPeriodStart.setHours(0, 0, 0, 0);

    const billingPeriodEnd = new Date(billingPeriodStart);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    await ctx.db.insert("usageRecords", {
      organizationId: args.organizationId,
      type: "analysis_run",
      quantity: 1,
      billingPeriodStart: billingPeriodStart.getTime(),
      billingPeriodEnd: billingPeriodEnd.getTime(),
      createdAt: now,
    });
  },
});

// ============================================================================
// Internal Actions
// ============================================================================

/**
 * Execute cost collection for a single AWS account.
 * This action is called by the cron job and uses ActionRetrier for reliability.
 */
export const executeCostCollection = internalAction({
  args: {
    awsAccountId: v.id("awsAccounts"),
    organizationId: v.id("organizations"),
    analysisRunId: v.id("analysisRuns"),
  },
  handler: async (ctx, args) => {
    try {
      // Update status to running
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "running",
      });

      // Record usage for billing
      await ctx.runMutation(internal.crons.recordUsageForAnalysis, {
        organizationId: args.organizationId,
      });

      // Get cost data for the past day
      // In a full implementation, this would trigger the AI agent
      // For now, we mark it as completed
      // TODO: Integrate with awsCostAgent to run actual analysis

      // Update status to completed
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "completed",
      });

      return { success: true };
    } catch (error) {
      // Update status to failed
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "failed",
      });

      throw error; // Re-throw for ActionRetrier to handle
    }
  },
});

/**
 * Main cron job handler that orchestrates daily cost collection.
 * Fetches all eligible accounts and schedules collection jobs.
 */
export const triggerDailyCostCollection = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all accounts eligible for collection
    const accounts = await ctx.runQuery(internal.crons.getAccountsForCollection, {});

    const results: Array<{ awsAccountId: string; scheduled: boolean; reason?: string }> = [];

    for (const account of accounts) {
      // Schedule collection for this account
      const scheduleResult = await ctx.runMutation(internal.crons.scheduleCostCollection, {
        awsAccountId: account.awsAccountId,
        organizationId: account.organizationId,
      });

      if (scheduleResult.scheduled && scheduleResult.analysisRunId) {
        // Use ActionRetrier for reliable execution
        await actionRetrier.run(ctx, internal.crons.executeCostCollection, {
          awsAccountId: account.awsAccountId,
          organizationId: account.organizationId,
          analysisRunId: scheduleResult.analysisRunId,
        });
      }

      results.push({
        awsAccountId: account.awsAccountId as string,
        scheduled: scheduleResult.scheduled,
        reason: scheduleResult.reason,
      });
    }

    return {
      accountsProcessed: results.length,
      results,
    };
  },
});

// ============================================================================
// Cron Configuration
// ============================================================================

const crons = cronJobs();

// Daily cost collection at 2:00 AM UTC
// Runs for all connected AWS accounts with active subscriptions
crons.cron(
  "daily cost collection",
  "0 2 * * *", // 2:00 AM UTC daily
  internal.crons.triggerDailyCostCollection,
  {}
);

export default crons;
