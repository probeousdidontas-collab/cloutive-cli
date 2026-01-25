/**
 * Alerts Management
 *
 * Features:
 * - List alerts for an organization
 * - Acknowledge alerts
 * - Get count of unacknowledged alerts
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

/**
 * List all alerts for the user's organization.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      return [];
    }

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    return alerts;
  },
});

/**
 * Get count of unacknowledged alerts.
 */
export const getUnacknowledgedCount = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      return 0;
    }

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Count alerts without acknowledgedAt
    const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledgedAt).length;

    return unacknowledgedCount;
  },
});

/**
 * Acknowledge an alert.
 */
export const acknowledge = mutation({
  args: {
    id: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    // Get the user's organization
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("Not authenticated");
    }

    const alert = await ctx.db.get(args.id);
    if (!alert) {
      throw new Error("Alert not found");
    }

    // Verify the alert belongs to the user's organization
    if (alert.organizationId !== organizationId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.id, {
      acknowledgedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
