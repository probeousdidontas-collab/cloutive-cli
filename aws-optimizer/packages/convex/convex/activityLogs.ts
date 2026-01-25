/**
 * Activity Logs Functions
 *
 * Implements US-045: Implement activity logging
 *
 * Features:
 * - List activity logs with filters (user, action, entity type, date range)
 * - Get unique users with activity in an organization
 * - Automatic 90-day retention filtering
 * - Requires organization membership for access
 */

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// Activity action types
const actionValidator = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("delete")
);

// Activity entity types
const entityTypeValidator = v.union(
  v.literal("organization"),
  v.literal("aws_account"),
  v.literal("budget"),
  v.literal("report"),
  v.literal("invitation")
);

// 90 days in milliseconds
const RETENTION_PERIOD_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Helper to check if a user is a member of an organization.
 */
async function checkMembership(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<boolean> {
  const membership = await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .first();
  return membership !== null;
}

/**
 * List activity logs for an organization with optional filters.
 * Automatically filters to logs within the last 90 days unless date range is specified.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    // Optional filters
    filterUserId: v.optional(v.id("users")),
    action: v.optional(actionValidator),
    entityType: v.optional(entityTypeValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, filterUserId, action, entityType, startDate, endDate, limit = 50 } = args;

    // Check membership
    const isMember = await checkMembership(ctx, organizationId, userId);
    if (!isMember) {
      throw new Error("You are not a member of this organization");
    }

    // Calculate date range (default to last 90 days)
    const now = Date.now();
    const effectiveStartDate = startDate ?? (now - RETENTION_PERIOD_MS);
    const effectiveEndDate = endDate ?? (now + 24 * 60 * 60 * 1000); // +1 day buffer

    // Query logs for the organization
    let logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    // Apply filters
    logs = logs.filter((log) => {
      // Date range filter
      if (log.createdAt < effectiveStartDate || log.createdAt > effectiveEndDate) {
        return false;
      }

      // User filter
      if (filterUserId && log.userId !== filterUserId) {
        return false;
      }

      // Action filter
      if (action && log.action !== action) {
        return false;
      }

      // Entity type filter
      if (entityType && log.entityType !== entityType) {
        return false;
      }

      return true;
    });

    // Sort by createdAt descending and apply limit
    logs = logs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Fetch user information for each log
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          user: user ? { _id: user._id, name: user.name, email: user.email } : null,
        };
      })
    );

    return {
      logs: logsWithUsers,
      hasMore: logs.length === limit,
    };
  },
});

/**
 * Get unique users who have activity logs in an organization.
 * Used for the user filter dropdown.
 */
export const getUsers = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = args;

    // Check membership
    const isMember = await checkMembership(ctx, organizationId, userId);
    if (!isMember) {
      throw new Error("You are not a member of this organization");
    }

    // Get all activity logs for the organization
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Get unique user IDs
    const userIds = [...new Set(logs.map((log) => log.userId))];

    // Fetch user information
    const users = await Promise.all(
      userIds.map(async (uid) => {
        const user = await ctx.db.get(uid);
        return user ? { _id: user._id, name: user.name, email: user.email } : null;
      })
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

/**
 * Internal mutation to log an activity.
 * Called from other mutations to record user actions.
 */
export const logActivity = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: actionValidator,
    entityType: entityTypeValidator,
    entityId: v.string(),
    details: v.optional(
      v.object({
        previousValues: v.optional(v.any()),
        newValues: v.optional(v.any()),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, action, entityType, entityId, details } = args;

    const logId = await ctx.db.insert("activityLogs", {
      organizationId,
      userId,
      action,
      entityType,
      entityId,
      details,
      createdAt: Date.now(),
    });

    return logId;
  },
});
