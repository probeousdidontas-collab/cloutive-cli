/**
 * Analysis Tools for AI Agent
 *
 * Implements US-016: Implement AI agent analysis tools
 *
 * These tools are called by the AI agent to persist analysis results:
 * - analysis_saveCostSnapshot - Save daily cost snapshots
 * - analysis_saveResource - Save discovered AWS resources
 * - recommendation_save - Save cost optimization recommendations
 * - analysis_generateReport - Generate and save reports
 *
 * All tools use internal mutations to store data in the database.
 */

import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

// Tool context type - matches @convex-dev/agent tool context
interface ToolContext {
  ctx: ActionCtx;
  userId?: string;
  threadId?: string;
  messageId?: string;
}

// Result types
interface SaveCostSnapshotResult {
  success: boolean;
  snapshotId: string;
  message: string;
}

interface SaveResourceResult {
  success: boolean;
  resourceDbId: string;
  message: string;
}

interface SaveRecommendationResult {
  success: boolean;
  recommendationId: string;
  message: string;
}

interface GenerateReportResult {
  success: boolean;
  reportId: string;
  status: string;
  message: string;
}

// ============================================================================
// analysis_saveCostSnapshot Tool
// ============================================================================

/**
 * Save a cost snapshot for an AWS account.
 *
 * Called by the AI agent to persist daily cost data gathered from AWS Cost Explorer.
 */
export const analysis_saveCostSnapshot = Object.assign(
  async function analysis_saveCostSnapshot(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      date: string;
      totalCost: number;
      serviceBreakdown?: Record<string, number>;
      regionBreakdown?: Record<string, number>;
    }
  ): Promise<SaveCostSnapshotResult> {
    const snapshotId = await ctx.runMutation(internal.ai.mutations.saveCostSnapshot, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      date: args.date,
      totalCost: args.totalCost,
      serviceBreakdown: args.serviceBreakdown,
      regionBreakdown: args.regionBreakdown,
    });

    return {
      success: true,
      snapshotId: snapshotId as string,
      message: `Cost snapshot saved for ${args.date} with total cost $${args.totalCost.toFixed(2)}`,
    };
  },
  {
    description:
      "Save a daily cost snapshot for an AWS account. Use this to persist cost data gathered from AWS Cost Explorer. Includes total cost and optional breakdown by service and region.",
    args: {
      awsAccountId: v.string(),
      date: v.string(),
      totalCost: v.number(),
      serviceBreakdown: v.optional(v.record(v.string(), v.number())),
      regionBreakdown: v.optional(v.record(v.string(), v.number())),
    },
  }
);

// ============================================================================
// analysis_saveResource Tool
// ============================================================================

/**
 * Save a discovered AWS resource.
 *
 * Called by the AI agent to persist resource inventory data.
 */
export const analysis_saveResource = Object.assign(
  async function analysis_saveResource(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      resourceType: string;
      resourceId: string;
      name?: string;
      region?: string;
      tags?: Record<string, string>;
      monthlyCost?: number;
    }
  ): Promise<SaveResourceResult> {
    const resourceDbId = await ctx.runMutation(internal.ai.mutations.saveResource, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      name: args.name,
      region: args.region,
      tags: args.tags,
      monthlyCost: args.monthlyCost,
    });

    return {
      success: true,
      resourceDbId: resourceDbId as string,
      message: `Resource ${args.resourceType}/${args.resourceId} saved${args.name ? ` (${args.name})` : ""}`,
    };
  },
  {
    description:
      "Save a discovered AWS resource to the inventory. Use this to persist EC2 instances, RDS databases, S3 buckets, Lambda functions, and other AWS resources found during analysis.",
    args: {
      awsAccountId: v.string(),
      resourceType: v.string(),
      resourceId: v.string(),
      name: v.optional(v.string()),
      region: v.optional(v.string()),
      tags: v.optional(v.record(v.string(), v.string())),
      monthlyCost: v.optional(v.number()),
    },
  }
);

// ============================================================================
// recommendation_save Tool
// ============================================================================

/**
 * Save a cost optimization recommendation.
 *
 * Called by the AI agent to persist savings recommendations.
 */
export const recommendation_save = Object.assign(
  async function recommendation_save(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      type: string;
      title: string;
      description: string;
      estimatedSavings: number;
      status?: string;
    }
  ): Promise<SaveRecommendationResult> {
    const recommendationId = await ctx.runMutation(internal.ai.mutations.saveRecommendation, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      type: args.type as "rightsizing" | "reserved_instance" | "savings_plan" | "unused_resource" | "idle_resource" | "storage_optimization" | "network_optimization",
      title: args.title,
      description: args.description,
      estimatedSavings: args.estimatedSavings,
      status: (args.status as "open" | "implemented" | "dismissed" | "in_progress") || "open",
    });

    return {
      success: true,
      recommendationId: recommendationId as string,
      message: `Recommendation saved: "${args.title}" with estimated savings of $${args.estimatedSavings.toFixed(2)}/month`,
    };
  },
  {
    description:
      "Save a cost optimization recommendation. Use this to persist savings opportunities identified during analysis, such as rightsizing, reserved instances, unused resources, and storage optimizations.",
    args: {
      awsAccountId: v.string(),
      type: v.string(),
      title: v.string(),
      description: v.string(),
      estimatedSavings: v.number(),
      status: v.optional(v.string()),
    },
  }
);

// ============================================================================
// analysis_generateReport Tool
// ============================================================================

/**
 * Generate and save an analysis report.
 *
 * Called by the AI agent to create cost analysis, savings, or inventory reports.
 */
export const analysis_generateReport = Object.assign(
  async function analysis_generateReport(
    { ctx }: ToolContext,
    args: {
      organizationId: string;
      type: string;
      title: string;
    }
  ): Promise<GenerateReportResult> {
    const reportId = await ctx.runMutation(internal.ai.mutations.createReport, {
      organizationId: args.organizationId as Id<"organizations">,
      type: args.type as "cost_analysis" | "savings_summary" | "resource_inventory" | "recommendation_summary" | "executive_summary",
      title: args.title,
    });

    return {
      success: true,
      reportId: reportId as string,
      status: "pending",
      message: `Report "${args.title}" created and queued for generation`,
    };
  },
  {
    description:
      "Generate an analysis report for an organization. Supported types: cost_analysis, savings_summary, resource_inventory, recommendation_summary, executive_summary. The report is queued for generation and can be retrieved later.",
    args: {
      organizationId: v.string(),
      type: v.string(),
      title: v.string(),
    },
  }
);

// ============================================================================
// Export all tools
// ============================================================================

/**
 * All analysis tools bundled for use with the AI agent.
 */
export const ANALYSIS_TOOLS = {
  analysis_saveCostSnapshot,
  analysis_saveResource,
  recommendation_save,
  analysis_generateReport,
};
