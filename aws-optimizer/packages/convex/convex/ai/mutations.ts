/**
 * Internal Mutations for AI Agent Tools
 *
 * Implements US-016: Implement AI agent analysis tools
 * Implements US-017: Implement AI agent notification tools
 *
 * These internal mutations are called by the AI agent tools to persist data:
 * - saveCostSnapshot - Store cost snapshot data
 * - saveResource - Store resource inventory items
 * - saveRecommendation - Store savings recommendations
 * - createReport - Create report records
 * - createAlert - Store alerts for dashboard display
 * - sendEmailNotification - Send emails via Resend
 */

import { v } from "convex/values";
import { Resend } from "@convex-dev/resend";
import { components } from "../_generated/api";
import { internalMutation, internalAction } from "../_generated/server";

// ============================================================================
// saveCostSnapshot
// ============================================================================

/**
 * Internal mutation to save a cost snapshot.
 * Called by analysis_saveCostSnapshot tool.
 */
export const saveCostSnapshot = internalMutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    date: v.string(),
    totalCost: v.number(),
    serviceBreakdown: v.optional(v.record(v.string(), v.number())),
    regionBreakdown: v.optional(v.record(v.string(), v.number())),
  },
  returns: v.id("costSnapshots"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if snapshot already exists for this account and date
    const existing = await ctx.db
      .query("costSnapshots")
      .withIndex("by_awsAccount_date", (q) =>
        q.eq("awsAccountId", args.awsAccountId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing snapshot
      await ctx.db.patch(existing._id, {
        totalCost: args.totalCost,
        serviceBreakdown: args.serviceBreakdown,
        regionBreakdown: args.regionBreakdown,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new snapshot
    return await ctx.db.insert("costSnapshots", {
      awsAccountId: args.awsAccountId,
      date: args.date,
      totalCost: args.totalCost,
      serviceBreakdown: args.serviceBreakdown,
      regionBreakdown: args.regionBreakdown,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// saveResource
// ============================================================================

/**
 * Internal mutation to save a discovered resource.
 * Called by analysis_saveResource tool.
 */
export const saveResource = internalMutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    resourceType: v.string(),
    resourceId: v.string(),
    name: v.optional(v.string()),
    region: v.optional(v.string()),
    tags: v.optional(v.record(v.string(), v.string())),
    monthlyCost: v.optional(v.number()),
  },
  returns: v.id("resources"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if resource already exists
    const existing = await ctx.db
      .query("resources")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", args.awsAccountId))
      .filter((q) =>
        q.and(
          q.eq(q.field("resourceType"), args.resourceType),
          q.eq(q.field("resourceId"), args.resourceId)
        )
      )
      .first();

    if (existing) {
      // Update existing resource
      await ctx.db.patch(existing._id, {
        name: args.name,
        region: args.region,
        tags: args.tags,
        monthlyCost: args.monthlyCost,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new resource
    return await ctx.db.insert("resources", {
      awsAccountId: args.awsAccountId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      name: args.name,
      region: args.region,
      tags: args.tags,
      monthlyCost: args.monthlyCost,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// saveRecommendation
// ============================================================================

// Recommendation type validator
const recommendationTypeValidator = v.union(
  v.literal("rightsizing"),
  v.literal("reserved_instance"),
  v.literal("savings_plan"),
  v.literal("unused_resource"),
  v.literal("idle_resource"),
  v.literal("storage_optimization"),
  v.literal("network_optimization")
);

// Recommendation status validator
const recommendationStatusValidator = v.union(
  v.literal("open"),
  v.literal("implemented"),
  v.literal("dismissed"),
  v.literal("in_progress")
);

/**
 * Internal mutation to save a recommendation.
 * Called by recommendation_save tool.
 */
export const saveRecommendation = internalMutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    type: recommendationTypeValidator,
    title: v.string(),
    description: v.string(),
    estimatedSavings: v.number(),
    status: recommendationStatusValidator,
  },
  returns: v.id("recommendations"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Always create a new recommendation (they are unique findings)
    return await ctx.db.insert("recommendations", {
      awsAccountId: args.awsAccountId,
      type: args.type,
      title: args.title,
      description: args.description,
      estimatedSavings: args.estimatedSavings,
      status: args.status,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// createReport
// ============================================================================

// Report type validator
const reportTypeValidator = v.union(
  v.literal("cost_analysis"),
  v.literal("savings_summary"),
  v.literal("resource_inventory"),
  v.literal("recommendation_summary"),
  v.literal("executive_summary")
);

/**
 * Internal mutation to create a report record.
 * Called by analysis_generateReport tool.
 */
export const createReport = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    type: reportTypeValidator,
    title: v.string(),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("reports", {
      organizationId: args.organizationId,
      type: args.type,
      title: args.title,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// createAlert (US-017)
// ============================================================================

// Alert type validator
const alertTypeValidator = v.union(
  v.literal("budget_exceeded"),
  v.literal("anomaly_detected"),
  v.literal("recommendation_available"),
  v.literal("cost_spike"),
  v.literal("resource_idle")
);

// Alert severity validator
const alertSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("critical")
);

/**
 * Internal mutation to create an alert.
 * Called by analysis_createAlert tool.
 */
export const createAlert = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    type: alertTypeValidator,
    title: v.string(),
    message: v.string(),
    severity: alertSeverityValidator,
  },
  returns: v.id("alerts"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("alerts", {
      organizationId: args.organizationId,
      type: args.type,
      title: args.title,
      message: args.message,
      severity: args.severity,
      triggeredAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// sendEmailNotification (US-017)
// ============================================================================

// Initialize Resend component
const resend = new Resend(components.resend, {
  testMode: process.env.NODE_ENV !== "production",
});

// Default sender email address
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "AWS Cost Optimizer <alerts@awsoptimizer.com>";

/**
 * Internal action to send an email notification via Resend.
 * Called by notification_send tool.
 */
export const sendEmailNotification = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    message: v.string(),
    html: v.optional(v.string()),
    alertId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Build email content - use html if provided, otherwise wrap message in basic HTML
      const htmlContent = args.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">AWS Cost Optimizer Notification</h2>
          <p style="color: #333; line-height: 1.6;">${args.message}</p>
          ${args.alertId ? `<p style="color: #666; font-size: 12px;">Alert ID: ${args.alertId}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">This is an automated notification from AWS Cost Optimizer.</p>
        </div>
      `;

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: args.to,
        subject: args.subject,
        html: htmlContent,
        text: args.message,
      });

      return {
        success: true,
        messageId: emailId,
        message: `Email sent successfully to ${args.to}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to send email notification:", errorMessage);
      
      return {
        success: false,
        message: `Failed to send email: ${errorMessage}`,
      };
    }
  },
});
