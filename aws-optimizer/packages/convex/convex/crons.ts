/**
 * Cron Jobs Configuration
 *
 * US-036: Implement cron jobs for scheduled analysis
 *
 * Scheduled tasks for the AWS Manager:
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
import { awsCostAgent } from "./ai/awsCostAgent";

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
    errorMessage: v.optional(v.string()),
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

    if (args.errorMessage) {
      updates.errorMessage = args.errorMessage;
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
 * Build the prompt that tells the AI agent what to collect for a given account.
 */
function buildCostCollectionPrompt(
  awsAccountId: string,
  organizationId: string,
): string {
  const today = new Date();

  // Build a 7-day backfill window to catch any gaps
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return `You are running a scheduled daily cost collection for AWS account ${awsAccountId} in organization ${organizationId}.

## Step 1 — Collect Cost Data

Use the aws_getCostData tool to fetch cost data for the following dates (grouped by SERVICE):
${dates.map((d) => `- ${d}`).join("\n")}

Then fetch the same dates grouped by REGION.

For each day, call analysis_saveCostSnapshot with:
- awsAccountId: "${awsAccountId}"
- date: the YYYY-MM-DD date
- totalCost: the total for that day
- serviceBreakdown: the per-service costs
- regionBreakdown: the per-region costs

If a day has zero cost data or an error, skip it silently.

## Step 2 — Discover Resources

Use aws_listResources for the following resource types: EC2, RDS, S3.
Pass awsAccountId: "${awsAccountId}".

For each discovered resource, call analysis_saveResource with the resource details.

## Step 3 — Generate Recommendations

Based on the cost data and resources you discovered, generate actionable cost optimization recommendations.
For each recommendation call recommendation_save with:
- awsAccountId: "${awsAccountId}"
- type: one of "rightsizing", "reserved_instance", "savings_plan", "unused_resource", "idle_resource", "storage_optimization", "network_optimization"
- title: short descriptive title
- description: detailed explanation
- estimatedSavings: estimated monthly savings in dollars

Focus on the highest-impact recommendations first. Generate at least 1 recommendation if any optimization opportunity exists.

## Important
- Do NOT make any changes to AWS resources — this is a read-only collection run.
- If any tool call fails, log the error and continue with the next step.
- Complete all three steps in order.`;
}

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
      // Pre-flight: verify Bedrock credentials are set
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error(
          "Bedrock credentials missing — set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY via `npx convex env set`"
        );
      }

      // Update status to running
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "running",
      });

      // Record usage for billing
      await ctx.runMutation(internal.crons.recordUsageForAnalysis, {
        organizationId: args.organizationId,
      });

      // Build the prompt for the AI agent
      const prompt = buildCostCollectionPrompt(
        args.awsAccountId,
        args.organizationId,
      );

      // Run the AI agent (same pattern as reportGeneration.ts)
      console.log(`[CostCollection] Creating AI agent thread for account ${args.awsAccountId}...`);
      const { thread } = await awsCostAgent.createThread(ctx, {});

      console.log(`[CostCollection] Running AI agent generateText...`);
      await thread.generateText(ctx, { prompt });
      console.log(`[CostCollection] AI agent completed for account ${args.awsAccountId}`);

      // Update status to completed
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "completed",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CostCollection] Failed for account ${args.awsAccountId}:`, errorMessage);

      // Update status to failed with error message
      await ctx.runMutation(internal.crons.updateAnalysisRunStatus, {
        analysisRunId: args.analysisRunId,
        status: "failed",
        errorMessage,
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
// Credential Expiry Monitoring (Phase 1)
// ============================================================================

/**
 * Get all credentials that are expiring soon or have expired.
 * Returns credentials with their associated AWS account and organization info.
 */
export const getExpiringCredentials = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      credentialId: v.id("awsCredentials"),
      awsAccountId: v.id("awsAccounts"),
      organizationId: v.id("organizations"),
      accountName: v.string(),
      expiresAt: v.number(),
      daysUntilExpiry: v.number(),
      validationStatus: v.string(),
    })
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

    // Get all credentials with expiry dates
    const allCredentials = await ctx.db.query("awsCredentials").collect();

    const expiringCredentials: Array<{
      credentialId: Id<"awsCredentials">;
      awsAccountId: Id<"awsAccounts">;
      organizationId: Id<"organizations">;
      accountName: string;
      expiresAt: number;
      daysUntilExpiry: number;
      validationStatus: string;
    }> = [];

    for (const cred of allCredentials) {
      // Skip credentials without expiry dates or already validated as healthy
      if (!cred.expiresAt) continue;

      // Check if expiring within 7 days or already expired
      if (cred.expiresAt > sevenDaysFromNow) continue;

      // Get the AWS account
      const awsAccount = await ctx.db.get(cred.awsAccountId);
      if (!awsAccount || awsAccount.status === "inactive") continue;

      const daysUntilExpiry = Math.floor((cred.expiresAt - now) / (24 * 60 * 60 * 1000));

      expiringCredentials.push({
        credentialId: cred._id,
        awsAccountId: cred.awsAccountId,
        organizationId: awsAccount.organizationId,
        accountName: awsAccount.name,
        expiresAt: cred.expiresAt,
        daysUntilExpiry,
        validationStatus: cred.validationStatus || "unknown",
      });
    }

    // Sort by days until expiry (most urgent first)
    expiringCredentials.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return expiringCredentials;
  },
});

/**
 * Create an alert for expiring credentials.
 */
export const createCredentialExpiryAlert = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    awsAccountId: v.id("awsAccounts"),
    accountName: v.string(),
    daysUntilExpiry: v.number(),
    isExpired: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if we already have an unacknowledged alert for this account
    const existingAlert = await ctx.db
      .query("alerts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "anomaly_detected"),
          q.eq(q.field("acknowledgedAt"), undefined)
        )
      )
      .collect();

    // Check if any existing alert is for this AWS account (check message content)
    const hasExistingAlert = existingAlert.some((alert) =>
      alert.message.includes(args.accountName) && alert.title.includes("Credential")
    );

    if (hasExistingAlert) {
      return { created: false, reason: "Alert already exists" };
    }

    const severity = args.isExpired ? "critical" : args.daysUntilExpiry <= 3 ? "warning" : "info";
    const title = args.isExpired
      ? `Credentials Expired: ${args.accountName}`
      : `Credentials Expiring Soon: ${args.accountName}`;
    const message = args.isExpired
      ? `The AWS credentials for account "${args.accountName}" have expired. Please update the credentials to continue cost analysis.`
      : `The AWS credentials for account "${args.accountName}" will expire in ${args.daysUntilExpiry} day${args.daysUntilExpiry === 1 ? "" : "s"}. Please refresh or update the credentials.`;

    await ctx.db.insert("alerts", {
      organizationId: args.organizationId,
      type: "anomaly_detected", // Using existing alert type for credential issues
      title,
      message,
      severity,
      triggeredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { created: true };
  },
});

/**
 * Update credential validation status based on expiry.
 */
export const updateCredentialExpiryStatus = internalMutation({
  args: {
    credentialId: v.id("awsCredentials"),
    validationStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.credentialId, {
      validationStatus: args.validationStatus as "healthy" | "expiring" | "expired" | "invalid" | "unknown",
      updatedAt: now,
    });
  },
});

// Types for credential expiry check
interface ExpiringCredential {
  credentialId: Id<"awsCredentials">;
  awsAccountId: Id<"awsAccounts">;
  organizationId: Id<"organizations">;
  accountName: string;
  expiresAt: number;
  daysUntilExpiry: number;
  validationStatus: string;
}

interface CredentialExpiryCheckResult {
  credentialsChecked: number;
  results: Array<{
    accountName: string;
    status: string;
    alertCreated: boolean;
  }>;
}

/**
 * Main cron job handler that checks for expiring credentials.
 * Runs daily to:
 * 1. Find credentials expiring within 7 days or already expired
 * 2. Update their validation status
 * 3. Create alerts for the organization
 */
export const triggerCredentialExpiryCheck = internalAction({
  args: {},
  handler: async (ctx): Promise<CredentialExpiryCheckResult> => {
    // Get all expiring credentials
    const expiringCredentials = await ctx.runQuery(
      internal.crons.getExpiringCredentials,
      {}
    ) as ExpiringCredential[];

    const results: Array<{
      accountName: string;
      status: string;
      alertCreated: boolean;
    }> = [];

    for (const cred of expiringCredentials) {
      const isExpired = cred.daysUntilExpiry < 0;
      const newStatus = isExpired ? "expired" : "expiring";

      // Update credential status
      await ctx.runMutation(internal.crons.updateCredentialExpiryStatus, {
        credentialId: cred.credentialId,
        validationStatus: newStatus,
      });

      // Create alert
      const alertResult = await ctx.runMutation(internal.crons.createCredentialExpiryAlert, {
        organizationId: cred.organizationId,
        awsAccountId: cred.awsAccountId,
        accountName: cred.accountName,
        daysUntilExpiry: cred.daysUntilExpiry,
        isExpired,
      }) as { created: boolean; reason?: string };

      results.push({
        accountName: cred.accountName,
        status: newStatus,
        alertCreated: alertResult.created,
      });
    }

    return {
      credentialsChecked: expiringCredentials.length,
      results,
    };
  },
});

// ============================================================================
// Weekly Summary Email Functions (US-037)
// ============================================================================

/**
 * Get organizations that have weekly email summaries enabled.
 * Returns organizations with their member emails for sending summaries.
 */
export const getOrganizationsForWeeklySummary = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      organizationId: v.id("organizations"),
      organizationName: v.string(),
      recipients: v.array(
        v.object({
          userId: v.id("users"),
          email: v.string(),
          name: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    // Get all organizations
    const organizations = await ctx.db.query("organizations").collect();

    const result: Array<{
      organizationId: Id<"organizations">;
      organizationName: string;
      recipients: Array<{
        userId: Id<"users">;
        email: string;
        name: string;
      }>;
    }> = [];

    for (const org of organizations) {
      // Check notification preferences
      const settings = org.settings as {
        enableNotifications?: boolean;
        notificationPreferences?: {
          emailFrequency?: string;
          alertTypes?: string[];
        };
      };

      // Skip if notifications are disabled
      if (settings.enableNotifications === false) continue;

      // Skip if email frequency is not weekly
      const emailFrequency = settings.notificationPreferences?.emailFrequency;
      if (emailFrequency !== "weekly") continue;

      // Get organization members with their user details
      const members = await ctx.db
        .query("orgMembers")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      const recipients: Array<{
        userId: Id<"users">;
        email: string;
        name: string;
      }> = [];

      for (const member of members) {
        const user = await ctx.db.get(member.userId);
        if (user && user.status === "active") {
          recipients.push({
            userId: user._id,
            email: user.email,
            name: user.name,
          });
        }
      }

      if (recipients.length > 0) {
        result.push({
          organizationId: org._id,
          organizationName: org.name,
          recipients,
        });
      }
    }

    return result;
  },
});

/**
 * Generate weekly summary data for an organization.
 * Includes total spend, top cost changes, and top recommendations.
 */
export const generateWeeklySummaryData = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalSpend: v.number(),
    previousWeekSpend: v.number(),
    percentChange: v.number(),
    topChanges: v.array(
      v.object({
        service: v.string(),
        currentCost: v.number(),
        previousCost: v.number(),
        change: v.number(),
      })
    ),
    topRecommendations: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        estimatedSavings: v.number(),
        type: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get all AWS accounts for this organization
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    let totalSpend = 0;
    let previousWeekSpend = 0;
    const serviceBreakdownCurrent: Record<string, number> = {};
    const serviceBreakdownPrevious: Record<string, number> = {};

    for (const account of awsAccounts) {
      // Get cost snapshots for the past week
      const currentWeekSnapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      for (const snapshot of currentWeekSnapshots) {
        const snapshotDate = new Date(snapshot.date);

        // Current week costs
        if (snapshotDate >= weekAgo && snapshotDate <= now) {
          totalSpend += snapshot.totalCost;

          // Aggregate service breakdown
          if (snapshot.serviceBreakdown) {
            for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
              serviceBreakdownCurrent[service] = (serviceBreakdownCurrent[service] || 0) + cost;
            }
          }
        }

        // Previous week costs
        if (snapshotDate >= twoWeeksAgo && snapshotDate < weekAgo) {
          previousWeekSpend += snapshot.totalCost;

          if (snapshot.serviceBreakdown) {
            for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
              serviceBreakdownPrevious[service] = (serviceBreakdownPrevious[service] || 0) + cost;
            }
          }
        }
      }
    }

    // Calculate percent change
    const percentChange = previousWeekSpend > 0
      ? ((totalSpend - previousWeekSpend) / previousWeekSpend) * 100
      : 0;

    // Calculate top cost changes by service
    const allServices = new Set([
      ...Object.keys(serviceBreakdownCurrent),
      ...Object.keys(serviceBreakdownPrevious),
    ]);

    const topChanges: Array<{
      service: string;
      currentCost: number;
      previousCost: number;
      change: number;
    }> = [];

    for (const service of allServices) {
      const currentCost = serviceBreakdownCurrent[service] || 0;
      const previousCost = serviceBreakdownPrevious[service] || 0;
      const change = currentCost - previousCost;

      topChanges.push({
        service,
        currentCost,
        previousCost,
        change,
      });
    }

    // Sort by absolute change and take top 5
    topChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const top5Changes = topChanges.slice(0, 5);

    // Get top recommendations
    const allRecommendations: Array<{
      title: string;
      description: string;
      estimatedSavings: number;
      type: string;
    }> = [];

    for (const account of awsAccounts) {
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .filter((q) => q.eq(q.field("status"), "open"))
        .collect();

      for (const rec of recommendations) {
        allRecommendations.push({
          title: rec.title,
          description: rec.description,
          estimatedSavings: rec.estimatedSavings,
          type: rec.type,
        });
      }
    }

    // Sort by estimated savings and take top 5
    allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
    const topRecommendations = allRecommendations.slice(0, 5);

    return {
      totalSpend,
      previousWeekSpend,
      percentChange,
      topChanges: top5Changes,
      topRecommendations,
    };
  },
});

/**
 * Send weekly summary email to a recipient.
 */
export const sendWeeklySummaryEmail = internalAction({
  args: {
    organizationId: v.id("organizations"),
    organizationName: v.string(),
    recipientEmail: v.string(),
    recipientName: v.string(),
    summaryData: v.object({
      totalSpend: v.number(),
      previousWeekSpend: v.number(),
      percentChange: v.number(),
      topChanges: v.array(
        v.object({
          service: v.string(),
          currentCost: v.number(),
          previousCost: v.number(),
          change: v.number(),
        })
      ),
      topRecommendations: v.array(
        v.object({
          title: v.string(),
          description: v.string(),
          estimatedSavings: v.number(),
          type: v.string(),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const { summaryData, organizationName, recipientEmail, recipientName } = args;

    // Format the email content
    const changeIndicator = summaryData.percentChange >= 0 ? "↑" : "↓";
    const changeColor = summaryData.percentChange >= 0 ? "#dc2626" : "#16a34a";

    const topChangesHtml = summaryData.topChanges.length > 0
      ? summaryData.topChanges
          .map((change) => {
            const changeSign = change.change >= 0 ? "+" : "";
            const itemChangeColor = change.change >= 0 ? "#dc2626" : "#16a34a";
            return `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${change.service}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">$${change.currentCost.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${itemChangeColor};">${changeSign}$${change.change.toFixed(2)}</td>
              </tr>
            `;
          })
          .join("")
      : '<tr><td colspan="3" style="padding: 8px; text-align: center; color: #666;">No significant changes this week</td></tr>';

    const recommendationsHtml = summaryData.topRecommendations.length > 0
      ? summaryData.topRecommendations
          .map(
            (rec) => `
              <div style="padding: 12px; margin-bottom: 8px; background: #f9fafb; border-radius: 6px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${rec.title}</div>
                <div style="color: #666; font-size: 14px; margin-bottom: 4px;">${rec.description}</div>
                <div style="color: #16a34a; font-weight: 500;">Potential savings: $${rec.estimatedSavings.toFixed(2)}/month</div>
              </div>
            `
          )
          .join("")
      : '<div style="padding: 12px; text-align: center; color: #666;">No new recommendations this week</div>';

    const totalPotentialSavings = summaryData.topRecommendations.reduce(
      (sum, rec) => sum + rec.estimatedSavings,
      0
    );

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0 0 8px 0; font-size: 24px;">Weekly Cost Summary</h1>
          <p style="margin: 0; opacity: 0.9;">${organizationName}</p>
        </div>
        
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 20px 0;">Hi ${recipientName},</p>
          <p style="margin: 0 0 24px 0; color: #374151;">Here's your weekly AWS cost summary:</p>
          
          <!-- Total Spend Card -->
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 36px; font-weight: 700; color: #1f2937;">$${summaryData.totalSpend.toFixed(2)}</div>
            <div style="color: #6b7280; margin-top: 4px;">Total spend this week</div>
            <div style="color: ${changeColor}; font-size: 14px; margin-top: 8px;">
              ${changeIndicator} ${Math.abs(summaryData.percentChange).toFixed(1)}% vs last week ($${summaryData.previousWeekSpend.toFixed(2)})
            </div>
          </div>
          
          <!-- Top Cost Changes -->
          <h2 style="font-size: 18px; margin: 0 0 16px 0; color: #1f2937;">Top Cost Changes</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px; text-align: left; font-weight: 600;">Service</th>
                <th style="padding: 8px; text-align: left; font-weight: 600;">Current</th>
                <th style="padding: 8px; text-align: left; font-weight: 600;">Change</th>
              </tr>
            </thead>
            <tbody>
              ${topChangesHtml}
            </tbody>
          </table>
          
          <!-- Top Recommendations -->
          <h2 style="font-size: 18px; margin: 0 0 16px 0; color: #1f2937;">Top Recommendations</h2>
          ${recommendationsHtml}
          
          ${totalPotentialSavings > 0 ? `
            <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin-top: 16px; text-align: center;">
              <div style="color: #166534; font-weight: 600;">Total Potential Monthly Savings: $${totalPotentialSavings.toFixed(2)}</div>
            </div>
          ` : ""}
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            This is an automated weekly summary from AWS Manager.
            <br />To change your notification preferences, visit your organization settings.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Weekly Cost Summary - ${organizationName}

Hi ${recipientName},

Here's your weekly AWS cost summary:

Total Spend: $${summaryData.totalSpend.toFixed(2)}
Change vs Last Week: ${changeIndicator} ${Math.abs(summaryData.percentChange).toFixed(1)}% ($${summaryData.previousWeekSpend.toFixed(2)})

Top Cost Changes:
${summaryData.topChanges.map((c) => `- ${c.service}: $${c.currentCost.toFixed(2)} (${c.change >= 0 ? "+" : ""}$${c.change.toFixed(2)})`).join("\n")}

Top Recommendations:
${summaryData.topRecommendations.map((r) => `- ${r.title}: Save $${r.estimatedSavings.toFixed(2)}/month`).join("\n")}

${totalPotentialSavings > 0 ? `Total Potential Monthly Savings: $${totalPotentialSavings.toFixed(2)}` : ""}

This is an automated weekly summary from AWS Manager.
    `.trim();

    // Send the email using the existing Resend infrastructure
    try {
      await ctx.runAction(internal.ai.mutations.sendEmailNotification, {
        to: recipientEmail,
        subject: `Weekly Cost Summary - ${organizationName} - $${summaryData.totalSpend.toFixed(2)}`,
        message: textContent,
        html: htmlContent,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to send weekly summary email:", error);
      return { success: false };
    }
  },
});

/**
 * Main cron job handler that triggers weekly summary emails.
 * Fetches all organizations with weekly email preference and sends summaries.
 */
export const triggerWeeklySummaryEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all organizations that want weekly summaries
    const organizations = await ctx.runQuery(internal.crons.getOrganizationsForWeeklySummary, {});

    const results: Array<{
      organizationId: string;
      emailsSent: number;
      success: boolean;
    }> = [];

    for (const org of organizations) {
      try {
        // Generate summary data for this organization
        const summaryData = await ctx.runQuery(internal.crons.generateWeeklySummaryData, {
          organizationId: org.organizationId,
        });

        let emailsSent = 0;

        // Send email to each recipient
        for (const recipient of org.recipients) {
          try {
            await ctx.runAction(internal.crons.sendWeeklySummaryEmail, {
              organizationId: org.organizationId,
              organizationName: org.organizationName,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              summaryData,
            });
            emailsSent++;
          } catch (error) {
            console.error(`Failed to send weekly summary to ${recipient.email}:`, error);
          }
        }

        results.push({
          organizationId: org.organizationId as string,
          emailsSent,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to generate summary for org ${org.organizationId}:`, error);
        results.push({
          organizationId: org.organizationId as string,
          emailsSent: 0,
          success: false,
        });
      }
    }

    return {
      organizationsProcessed: results.length,
      results,
    };
  },
});

// ============================================================================
// Cron Configuration
// ============================================================================
// Single scheduler tick every 5 minutes. All actual job scheduling is
// table-driven via the cronSchedules table, managed by cronManager.ts.

const crons = cronJobs();

crons.cron(
  "scheduler tick",
  "*/5 * * * *",
  internal.cronManager.schedulerTick,
  {}
);

export default crons;
