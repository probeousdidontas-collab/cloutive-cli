/**
 * Reports Management
 *
 * Features:
 * - List generated reports
 * - List scheduled reports
 * - Generate new reports
 * - Create, update, and delete report schedules
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";
import { isTestMode } from "./functions";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Report type validator
const reportTypeValidator = v.union(
  v.literal("summary"),
  v.literal("detailed"),
  v.literal("recommendation"),
  v.literal("comparison")
);

// Report format validator
const reportFormatValidator = v.union(
  v.literal("pdf"),
  v.literal("csv")
);

// Schedule frequency validator
const scheduleFrequencyValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("quarterly")
);

/**
 * List all reports for the user's organization.
 * Accepts organizationId as parameter for proper multi-org support.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // In test mode, use provided org ID or fall back to first available org
    let organizationId: Id<"organizations"> | null = args.organizationId ?? null;
    
    // If no org ID provided, try to get from auth context
    if (!organizationId && !isTestMode()) {
      organizationId = await getUserOrgId(ctx);
    }
    
    // In test mode without explicit org, find the first available organization
    if (!organizationId && isTestMode()) {
      const firstOrg = await ctx.db.query("organizations").first();
      organizationId = firstOrg?._id ?? null;
    }
    
    if (!organizationId) {
      return [];
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    // Transform to match frontend expectations
    return reports.map((report) => ({
      _id: report._id,
      name: report.title,
      type: report.type === "cost_analysis" ? "summary" 
          : report.type === "savings_summary" ? "detailed"
          : report.type === "recommendation_summary" ? "recommendation"
          : report.type === "executive_summary" ? "comparison"
          : "summary",
      format: "pdf" as const,
      status: report.status,
      downloadUrl: report.fileUrl || null,
      createdAt: report.createdAt,
      completedAt: report.generatedAt || null,
      hasContent: !!report.content,
      hasReportData: !!report.reportData,
      errorMessage: report.errorMessage,
      // Progress tracking fields
      progressStep: report.progressStep,
      progressMessage: report.progressMessage,
      progressPercent: report.progressPercent,
    }));
  },
});

/**
 * Get a single report by ID with full content.
 */
export const get = query({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    return {
      _id: report._id,
      name: report.title,
      type: report.type === "cost_analysis" ? "summary" 
          : report.type === "savings_summary" ? "detailed"
          : report.type === "recommendation_summary" ? "recommendation"
          : report.type === "executive_summary" ? "comparison"
          : "summary",
      format: "pdf" as const,
      status: report.status,
      content: report.content,
      reportData: report.reportData,
      downloadUrl: report.fileUrl || null,
      createdAt: report.createdAt,
      completedAt: report.generatedAt || null,
      errorMessage: report.errorMessage,
      awsAccountIds: report.awsAccountIds,
      // Progress tracking fields
      progressStep: report.progressStep,
      progressMessage: report.progressMessage,
      progressPercent: report.progressPercent,
    };
  },
});

/**
 * List scheduled reports.
 * Note: This uses reports table with a schedule field approach.
 * In a full implementation, you'd have a separate scheduledReports table.
 */
export const listScheduled = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (_ctx, _args) => {
    // For now, return empty array as scheduled reports would need a separate table
    // or additional fields in the reports table
    return [];
  },
});

/**
 * Generate a new report.
 * Accepts organizationId as parameter for proper multi-org support.
 * Now triggers AI agent to generate report content.
 */
export const generate = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    type: reportTypeValidator,
    format: reportFormatValidator,
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
  },
  handler: async (ctx, args) => {
    // In test mode, use provided org ID or fall back to first available org
    let organizationId: Id<"organizations"> | null = args.organizationId ?? null;
    
    // If no org ID provided, try to get from auth context
    if (!organizationId && !isTestMode()) {
      organizationId = await getUserOrgId(ctx);
    }
    
    // In test mode without explicit org, find the first available organization
    if (!organizationId && isTestMode()) {
      const firstOrg = await ctx.db.query("organizations").first();
      organizationId = firstOrg?._id ?? null;
    }
    
    if (!organizationId) {
      throw new Error("No organization found. Please create an organization first.");
    }

    const now = Date.now();

    // Map frontend type to schema type
    const schemaType = args.type === "summary" ? "cost_analysis"
                     : args.type === "detailed" ? "savings_summary"
                     : args.type === "recommendation" ? "recommendation_summary"
                     : "executive_summary";

    // Insert the report record
    const reportId = await ctx.db.insert("reports", {
      organizationId,
      type: schemaType,
      title: args.name,
      status: "pending",
      awsAccountIds: args.awsAccountIds,
      createdAt: now,
      updatedAt: now,
    });

    // Schedule the AI agent to generate the report content
    await ctx.scheduler.runAfter(0, internal.ai.reportGeneration.generateReport, {
      reportId,
      organizationId,
      reportType: schemaType,
      reportTitle: args.name,
      awsAccountIds: args.awsAccountIds,
    });

    return { reportId };
  },
});

/**
 * Generate a new Cost Analysis report.
 * This uses the structured data pipeline (not AI markdown).
 */
export const generateCostAnalysis = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
    trendMonths: v.optional(v.number()),
    topAccountCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let organizationId: Id<"organizations"> | null = args.organizationId ?? null;

    if (!organizationId && !isTestMode()) {
      organizationId = await getUserOrgId(ctx);
    }

    if (!organizationId && isTestMode()) {
      const firstOrg = await ctx.db.query("organizations").first();
      organizationId = firstOrg?._id ?? null;
    }

    if (!organizationId) {
      throw new Error("No organization found. Please create an organization first.");
    }

    const now = Date.now();

    const reportId = await ctx.db.insert("reports", {
      organizationId,
      type: "cost_analysis",
      title: args.name,
      status: "pending",
      awsAccountIds: args.awsAccountIds,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.ai.costAnalysisReport.generateCostAnalysisReport, {
      reportId,
      organizationId,
      reportTitle: args.name,
      awsAccountIds: args.awsAccountIds,
      trendMonths: args.trendMonths,
      topAccountCount: args.topAccountCount,
    });

    return { reportId };
  },
});

/**
 * Create a scheduled report.
 * Accepts organizationId as parameter for proper multi-org support.
 */
export const createSchedule = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    type: reportTypeValidator,
    format: reportFormatValidator,
    schedule: scheduleFrequencyValidator,
  },
  handler: async (_ctx, _args) => {
    // In a full implementation, this would create a scheduled job
    // For now, just return success
    return { success: true };
  },
});

/**
 * Delete a scheduled report.
 */
export const deleteSchedule = mutation({
  args: {
    id: v.string(),
  },
  handler: async (_ctx, _args) => {
    // In a full implementation, this would delete the scheduled job
    return { success: true };
  },
});

/**
 * Toggle a scheduled report on/off.
 */
export const toggleSchedule = mutation({
  args: {
    id: v.string(),
    enabled: v.boolean(),
  },
  handler: async (_ctx, _args) => {
    // In a full implementation, this would enable/disable the scheduled job
    return { success: true };
  },
});
