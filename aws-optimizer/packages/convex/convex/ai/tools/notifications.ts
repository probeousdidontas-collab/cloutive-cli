/**
 * Notification Tools for AI Agent
 *
 * Implements US-017: Implement AI agent notification tools
 *
 * These tools are called by the AI agent to send notifications:
 * - notification_send - Send email notifications via Resend
 * - analysis_createAlert - Create budget/anomaly alerts
 *
 * All tools use internal mutations to store data and actions for email delivery.
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
interface SendNotificationResult {
  success: boolean;
  messageId?: string;
  message: string;
}

interface CreateAlertResult {
  success: boolean;
  alertId: string;
  emailSent: boolean;
  message: string;
}

// ============================================================================
// notification_send Tool
// ============================================================================

/**
 * Send an email notification via Resend.
 *
 * Called by the AI agent to notify users about important findings,
 * reports, or alerts.
 */
export const notification_send = Object.assign(
  async function notification_send(
    { ctx }: ToolContext,
    args: {
      organizationId: string;
      to: string;
      subject: string;
      message: string;
      html?: string;
      alertId?: string;
    }
  ): Promise<SendNotificationResult> {
    const result = await ctx.runAction(internal.ai.mutations.sendEmailNotification, {
      to: args.to,
      subject: args.subject,
      message: args.message,
      html: args.html,
      alertId: args.alertId,
    });

    return result;
  },
  {
    description:
      "Send an email notification to a user via Resend. Use this to notify users about important cost findings, completed reports, budget alerts, or critical anomalies. Supports both plain text and HTML content.",
    args: {
      organizationId: v.string(),
      to: v.string(),
      subject: v.string(),
      message: v.string(),
      html: v.optional(v.string()),
      alertId: v.optional(v.string()),
    },
  }
);

// ============================================================================
// analysis_createAlert Tool
// ============================================================================

/**
 * Create a budget or anomaly alert.
 *
 * Called by the AI agent to create alerts for budget thresholds,
 * cost anomalies, and other important findings.
 */
export const analysis_createAlert = Object.assign(
  async function analysis_createAlert(
    { ctx }: ToolContext,
    args: {
      organizationId: string;
      type: string;
      title: string;
      message: string;
      severity: string;
      sendEmail?: boolean;
      recipientEmail?: string;
    }
  ): Promise<CreateAlertResult> {
    // Create the alert in the database
    const alertId = await ctx.runMutation(internal.ai.mutations.createAlert, {
      organizationId: args.organizationId as Id<"organizations">,
      type: args.type as "budget_exceeded" | "anomaly_detected" | "recommendation_available" | "cost_spike" | "resource_idle",
      title: args.title,
      message: args.message,
      severity: args.severity as "info" | "warning" | "critical",
    });

    let emailSent = false;

    // Optionally send an email notification
    if (args.sendEmail && args.recipientEmail) {
      const emailResult = await ctx.runAction(internal.ai.mutations.sendEmailNotification, {
        to: args.recipientEmail,
        subject: `[${args.severity.toUpperCase()}] ${args.title}`,
        message: args.message,
        alertId: alertId as string,
      });
      emailSent = emailResult.success;
    }

    return {
      success: true,
      alertId: alertId as string,
      emailSent,
      message: `Alert created: "${args.title}"${emailSent ? " and email notification sent" : ""}`,
    };
  },
  {
    description:
      "Create a budget or anomaly alert and optionally send an email notification. Use this to alert users about budget threshold breaches, detected cost anomalies, cost spikes, idle resources, or new recommendations. Alerts are stored in the database for dashboard display.",
    args: {
      organizationId: v.string(),
      type: v.string(),
      title: v.string(),
      message: v.string(),
      severity: v.string(),
      sendEmail: v.optional(v.boolean()),
      recipientEmail: v.optional(v.string()),
    },
  }
);

// ============================================================================
// Export all tools
// ============================================================================

/**
 * All notification tools bundled for use with the AI agent.
 */
export const NOTIFICATION_TOOLS = {
  notification_send,
  analysis_createAlert,
};
