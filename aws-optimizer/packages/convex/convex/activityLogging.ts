/**
 * Activity Logging Helper
 *
 * Implements US-045: Implement activity logging
 *
 * This module provides helper functions for logging activities
 * from mutations throughout the application.
 */

import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type ActivityAction = "create" | "update" | "delete";
export type ActivityEntityType = "organization" | "aws_account" | "budget" | "report" | "invitation";

export interface LogActivityParams {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  details?: {
    previousValues?: unknown;
    newValues?: unknown;
    description?: string;
  };
}

/**
 * Log an activity from a mutation.
 * This is the standard way to log activities throughout the application.
 */
export async function logActivity(
  ctx: MutationCtx,
  params: LogActivityParams
): Promise<Id<"activityLogs">> {
  const { organizationId, userId, action, entityType, entityId, details } = params;

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
}

/**
 * Helper to create a description for common actions.
 */
export function createActivityDescription(
  action: ActivityAction,
  entityType: ActivityEntityType,
  entityName?: string
): string {
  const entityLabel = entityName || formatEntityType(entityType);

  switch (action) {
    case "create":
      return `Created ${entityLabel}`;
    case "update":
      return `Updated ${entityLabel}`;
    case "delete":
      return `Deleted ${entityLabel}`;
    default:
      return `${action} ${entityLabel}`;
  }
}

/**
 * Format entity type for display.
 */
function formatEntityType(entityType: ActivityEntityType): string {
  return entityType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
