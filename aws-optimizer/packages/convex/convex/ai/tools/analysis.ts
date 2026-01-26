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

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

// ============================================================================
// analysis_saveCostSnapshot Tool
// ============================================================================

/**
 * Save a cost snapshot for an AWS account.
 */
export const analysis_saveCostSnapshot = createTool({
  description:
    "Save a daily cost snapshot for an AWS account. Use this to persist cost data gathered from AWS Cost Explorer. Includes total cost and optional breakdown by service and region.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID this snapshot is for"),
    date: z.string().describe("Date of the snapshot in YYYY-MM-DD format"),
    totalCost: z.number().describe("Total cost in dollars for this day"),
    serviceBreakdown: z.record(z.string(), z.number()).optional().describe("Cost breakdown by service name"),
    regionBreakdown: z.record(z.string(), z.number()).optional().describe("Cost breakdown by region"),
  }),
  handler: async (ctx, args) => {
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
});

// ============================================================================
// analysis_saveResource Tool
// ============================================================================

/**
 * Save a discovered AWS resource.
 */
export const analysis_saveResource = createTool({
  description:
    "Save a discovered AWS resource to the inventory. Use this to persist EC2 instances, RDS databases, S3 buckets, Lambda functions, and other AWS resources found during analysis.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID this resource belongs to"),
    resourceType: z.string().describe("Type of resource: EC2, RDS, S3, Lambda, EBS, etc."),
    resourceId: z.string().describe("AWS resource ID (e.g., i-1234567890abcdef0)"),
    name: z.string().optional().describe("Resource name (from Name tag or similar)"),
    region: z.string().optional().describe("AWS region where the resource is located"),
    tags: z.record(z.string(), z.string()).optional().describe("Resource tags as key-value pairs"),
    monthlyCost: z.number().optional().describe("Estimated monthly cost in dollars"),
  }),
  handler: async (ctx, args) => {
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
});

// ============================================================================
// recommendation_save Tool
// ============================================================================

/**
 * Save a cost optimization recommendation.
 */
export const recommendation_save = createTool({
  description:
    "Save a cost optimization recommendation. Use this to persist savings opportunities identified during analysis, such as rightsizing, reserved instances, unused resources, and storage optimizations.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID this recommendation is for"),
    type: z.string().describe("Type: rightsizing, reserved_instance, savings_plan, unused_resource, idle_resource, storage_optimization, network_optimization"),
    title: z.string().describe("Short title describing the recommendation"),
    description: z.string().describe("Detailed description with actionable steps"),
    estimatedSavings: z.number().describe("Estimated monthly savings in dollars"),
    status: z.string().optional().describe("Status: open, implemented, dismissed, in_progress (default: open)"),
  }),
  handler: async (ctx, args) => {
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
});

// ============================================================================
// analysis_generateReport Tool
// ============================================================================

/**
 * Generate and save an analysis report.
 */
export const analysis_generateReport = createTool({
  description:
    "Generate an analysis report for an organization. Supported types: cost_analysis, savings_summary, resource_inventory, recommendation_summary, executive_summary. The report is queued for generation and can be retrieved later.",
  args: z.object({
    organizationId: z.string().describe("The organization ID to generate the report for"),
    type: z.string().describe("Report type: cost_analysis, savings_summary, resource_inventory, recommendation_summary, executive_summary"),
    title: z.string().describe("Title for the report"),
  }),
  handler: async (ctx, args) => {
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
});

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
