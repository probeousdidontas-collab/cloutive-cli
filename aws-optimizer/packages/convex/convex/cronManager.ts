/**
 * Cron Manager
 *
 * Table-driven cron scheduler with full CRUD management from the UI.
 * A single static cron tick (every 5 min) reads the cronSchedules table,
 * dispatches due handlers, and logs execution results.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
  action,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  validateCronExpression,
  getNextRunTime,
  cronToHuman,
} from "./cronUtils";

// ============================================================================
// Handler Registry
// ============================================================================
// Maps handlerKey strings to internal action references.
// New handlers must be registered here to be callable from the scheduler.

const HANDLER_REGISTRY: Record<string, unknown> = {
  triggerDailyCostCollection: "internal.crons.triggerDailyCostCollection",
  triggerCredentialExpiryCheck: "internal.crons.triggerCredentialExpiryCheck",
  triggerWeeklySummaryEmails: "internal.crons.triggerWeeklySummaryEmails",
};

// We resolve handler references lazily at dispatch time since internal.*
// references are only available inside Convex function handlers.
function resolveHandler(handlerKey: string) {
  switch (handlerKey) {
    case "triggerDailyCostCollection":
      return internal.crons.triggerDailyCostCollection;
    case "triggerCredentialExpiryCheck":
      return internal.crons.triggerCredentialExpiryCheck;
    case "triggerWeeklySummaryEmails":
      return internal.crons.triggerWeeklySummaryEmails;
    default:
      return null;
  }
}

// ============================================================================
// Default Schedules
// ============================================================================

const DEFAULT_SCHEDULES = [
  {
    name: "Daily Cost Collection",
    description: "Collect cost data for all connected AWS accounts",
    cronExpression: "0 2 * * *",
    handlerKey: "triggerDailyCostCollection",
  },
  {
    name: "Credential Expiry Check",
    description: "Check for expiring AWS credentials and create alerts",
    cronExpression: "0 6 * * *",
    handlerKey: "triggerCredentialExpiryCheck",
  },
  {
    name: "Weekly Summary Emails",
    description: "Send weekly cost summary emails to subscribed organizations",
    cronExpression: "0 8 * * 1",
    handlerKey: "triggerWeeklySummaryEmails",
  },
];

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * Seed default schedules if the cronSchedules table is empty.
 * Idempotent — only inserts if no schedules exist.
 */
export const seedDefaultSchedules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("cronSchedules").first();
    if (existing) return { seeded: false };

    const now = Date.now();
    for (const sched of DEFAULT_SCHEDULES) {
      const nextRunAt = getNextRunTime(sched.cronExpression, now);
      await ctx.db.insert("cronSchedules", {
        ...sched,
        enabled: true,
        nextRunAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { seeded: true, count: DEFAULT_SCHEDULES.length };
  },
});

/**
 * Get all enabled schedules that are due to run.
 */
export const getEnabledSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cronSchedules")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

/**
 * Create an execution log entry.
 */
export const createExecutionLog = internalMutation({
  args: {
    cronScheduleId: v.id("cronSchedules"),
    jobName: v.string(),
    trigger: v.union(v.literal("scheduled"), v.literal("manual")),
    status: v.union(v.literal("running"), v.literal("skipped")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cronExecutionLog", {
      cronScheduleId: args.cronScheduleId,
      jobName: args.jobName,
      status: args.status,
      trigger: args.trigger,
      startedAt: now,
      createdAt: now,
    });
  },
});

/**
 * Complete an execution log entry with final status.
 */
export const completeExecutionLog = internalMutation({
  args: {
    logId: v.id("cronExecutionLog"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("skipped")),
    errorMessage: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) return;

    const now = Date.now();
    await ctx.db.patch(args.logId, {
      status: args.status,
      completedAt: now,
      durationMs: now - log.startedAt,
      errorMessage: args.errorMessage,
      resultSummary: args.resultSummary,
    });
  },
});

/**
 * Update a schedule after a run completes.
 */
export const updateScheduleAfterRun = internalMutation({
  args: {
    scheduleId: v.id("cronSchedules"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("running")),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) return;

    const now = Date.now();
    const nextRunAt = getNextRunTime(schedule.cronExpression, now);

    await ctx.db.patch(args.scheduleId, {
      lastRunAt: now,
      lastRunStatus: args.status,
      nextRunAt,
      updatedAt: now,
    });
  },
});

/**
 * Execute a single job by handler key (used for both scheduled and manual runs).
 */
export const executeJob = internalAction({
  args: {
    scheduleId: v.id("cronSchedules"),
    handlerKey: v.string(),
    logId: v.id("cronExecutionLog"),
  },
  handler: async (ctx, args) => {
    const handler = resolveHandler(args.handlerKey);
    if (!handler) {
      await ctx.runMutation(internal.cronManager.completeExecutionLog, {
        logId: args.logId,
        status: "failed",
        errorMessage: `Unknown handler key: ${args.handlerKey}`,
      });
      await ctx.runMutation(internal.cronManager.updateScheduleAfterRun, {
        scheduleId: args.scheduleId,
        status: "failed",
      });
      return;
    }

    try {
      // Mark schedule as running
      await ctx.runMutation(internal.cronManager.updateScheduleAfterRun, {
        scheduleId: args.scheduleId,
        status: "running",
      });

      // Dispatch the handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.runAction(handler as any, {});

      // Mark as completed
      await ctx.runMutation(internal.cronManager.completeExecutionLog, {
        logId: args.logId,
        status: "completed",
        resultSummary: "Job completed successfully",
      });
      await ctx.runMutation(internal.cronManager.updateScheduleAfterRun, {
        scheduleId: args.scheduleId,
        status: "completed",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.cronManager.completeExecutionLog, {
        logId: args.logId,
        status: "failed",
        errorMessage,
      });
      await ctx.runMutation(internal.cronManager.updateScheduleAfterRun, {
        scheduleId: args.scheduleId,
        status: "failed",
      });
    }
  },
});

/**
 * Main scheduler tick — the single static cron calls this every 5 minutes.
 * Seeds defaults on first run, then dispatches all due jobs.
 */
export const schedulerTick = internalAction({
  args: {},
  handler: async (ctx) => {
    // Seed default schedules on first run
    await ctx.runMutation(internal.cronManager.seedDefaultSchedules, {});

    const now = Date.now();

    // Get all enabled schedules
    const schedules = await ctx.runQuery(internal.cronManager.getEnabledSchedules, {});

    for (const schedule of schedules) {
      // Check if due: nextRunAt is in the past (or not set)
      if (schedule.nextRunAt && schedule.nextRunAt > now) {
        continue; // Not due yet
      }

      // Concurrent execution guard: skip if still running from a recent invocation
      if (
        schedule.lastRunStatus === "running" &&
        schedule.lastRunAt &&
        now - schedule.lastRunAt < 60 * 60 * 1000 // within past hour
      ) {
        // Log as skipped
        const logId = await ctx.runMutation(internal.cronManager.createExecutionLog, {
          cronScheduleId: schedule._id,
          jobName: schedule.name,
          trigger: "scheduled",
          status: "skipped",
        });
        await ctx.runMutation(internal.cronManager.completeExecutionLog, {
          logId,
          status: "skipped",
          resultSummary: "Skipped: previous execution still running",
        });
        // Advance nextRunAt so we don't keep skipping
        const nextRunAt = getNextRunTime(schedule.cronExpression, now);
        await ctx.runMutation(internal.cronManager.advanceNextRunAt, {
          scheduleId: schedule._id,
          nextRunAt,
        });
        continue;
      }

      // Create execution log
      const logId = await ctx.runMutation(internal.cronManager.createExecutionLog, {
        cronScheduleId: schedule._id,
        jobName: schedule.name,
        trigger: "scheduled",
        status: "running",
      });

      // Dispatch the job asynchronously
      await ctx.scheduler.runAfter(0, internal.cronManager.executeJob, {
        scheduleId: schedule._id,
        handlerKey: schedule.handlerKey,
        logId,
      });
    }
  },
});

/**
 * Advance nextRunAt without changing run status (used when skipping).
 */
export const advanceNextRunAt = internalMutation({
  args: {
    scheduleId: v.id("cronSchedules"),
    nextRunAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scheduleId, {
      nextRunAt: args.nextRunAt,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================================
// Public CRUD (exposed to frontend via api.cronManager.*)
// ============================================================================

/**
 * List all cron schedules sorted by name.
 */
export const listSchedules = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("cronSchedules").collect();
    return schedules
      .map((s) => ({
        ...s,
        humanReadable: cronToHuman(s.cronExpression),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single schedule by ID.
 */
export const getSchedule = query({
  args: { id: v.id("cronSchedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) return null;
    return {
      ...schedule,
      humanReadable: cronToHuman(schedule.cronExpression),
    };
  },
});

/**
 * Get execution log for a specific schedule, most recent first.
 */
export const getExecutionLog = query({
  args: {
    cronScheduleId: v.id("cronSchedules"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const logs = await ctx.db
      .query("cronExecutionLog")
      .withIndex("by_cronSchedule", (q) => q.eq("cronScheduleId", args.cronScheduleId))
      .order("desc")
      .take(limit);
    return logs;
  },
});

/**
 * Get recent executions across all schedules.
 */
export const getRecentExecutions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("cronExecutionLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

/**
 * Validate a cron expression and return next 5 fire times.
 */
export const validateCron = query({
  args: { expression: v.string() },
  handler: async (_ctx, args) => {
    const error = validateCronExpression(args.expression);
    if (error) {
      return { valid: false, error, nextFireTimes: [], humanReadable: "" };
    }

    const now = Date.now();
    const nextFireTimes: number[] = [];
    let after = now;
    for (let i = 0; i < 5; i++) {
      const next = getNextRunTime(args.expression, after);
      nextFireTimes.push(next);
      after = next;
    }

    return {
      valid: true,
      error: null,
      nextFireTimes,
      humanReadable: cronToHuman(args.expression),
    };
  },
});

/**
 * Toggle a schedule's enabled state.
 */
export const toggleSchedule = mutation({
  args: { id: v.id("cronSchedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) throw new Error("Schedule not found");

    const now = Date.now();
    const enabled = !schedule.enabled;
    const nextRunAt = enabled ? getNextRunTime(schedule.cronExpression, now) : undefined;

    await ctx.db.patch(args.id, {
      enabled,
      nextRunAt,
      updatedAt: now,
    });

    return { enabled };
  },
});

/**
 * Update a schedule's properties.
 */
export const updateSchedule = mutation({
  args: {
    id: v.id("cronSchedules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    cronExpression: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) throw new Error("Schedule not found");

    if (args.cronExpression) {
      const error = validateCronExpression(args.cronExpression);
      if (error) throw new Error(`Invalid cron expression: ${error}`);
    }

    const now = Date.now();
    const cronExpr = args.cronExpression ?? schedule.cronExpression;
    const enabled = args.enabled ?? schedule.enabled;
    const nextRunAt = enabled ? getNextRunTime(cronExpr, now) : undefined;

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.cronExpression !== undefined && { cronExpression: args.cronExpression }),
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      nextRunAt,
      updatedAt: now,
    });
  },
});

/**
 * Create a new schedule.
 */
export const createSchedule = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    cronExpression: v.string(),
    handlerKey: v.string(),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate cron expression
    const error = validateCronExpression(args.cronExpression);
    if (error) throw new Error(`Invalid cron expression: ${error}`);

    // Validate handler key
    if (!(args.handlerKey in HANDLER_REGISTRY)) {
      throw new Error(`Unknown handler key: ${args.handlerKey}. Valid keys: ${Object.keys(HANDLER_REGISTRY).join(", ")}`);
    }

    // Check for duplicate name
    const existing = await ctx.db
      .query("cronSchedules")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) throw new Error(`A schedule named "${args.name}" already exists`);

    const now = Date.now();
    const enabled = args.enabled ?? true;
    const nextRunAt = enabled ? getNextRunTime(args.cronExpression, now) : undefined;

    return await ctx.db.insert("cronSchedules", {
      name: args.name,
      description: args.description,
      cronExpression: args.cronExpression,
      handlerKey: args.handlerKey,
      enabled,
      nextRunAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Delete a schedule and all its execution logs.
 */
export const deleteSchedule = mutation({
  args: { id: v.id("cronSchedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) throw new Error("Schedule not found");

    // Delete all execution logs for this schedule
    const logs = await ctx.db
      .query("cronExecutionLog")
      .withIndex("by_cronSchedule", (q) => q.eq("cronScheduleId", args.id))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    // Delete the schedule
    await ctx.db.delete(args.id);
  },
});

/**
 * Trigger a manual run of a schedule.
 */
export const triggerManualRun = action({
  args: { id: v.id("cronSchedules") },
  handler: async (ctx, args): Promise<{ logId: Id<"cronExecutionLog"> }> => {
    // Get the schedule
    const schedule: { name: string; handlerKey: string } | null = await ctx.runQuery(
      internal.cronManager.getScheduleInternal,
      { id: args.id }
    );
    if (!schedule) throw new Error("Schedule not found");

    // Create execution log
    const logId: Id<"cronExecutionLog"> = await ctx.runMutation(internal.cronManager.createExecutionLog, {
      cronScheduleId: args.id,
      jobName: schedule.name,
      trigger: "manual" as const,
      status: "running" as const,
    });

    // Dispatch immediately
    await ctx.scheduler.runAfter(0, internal.cronManager.executeJob, {
      scheduleId: args.id,
      handlerKey: schedule.handlerKey,
      logId,
    });

    return { logId };
  },
});

/**
 * Internal query to get a schedule (used by triggerManualRun action).
 */
export const getScheduleInternal = internalQuery({
  args: { id: v.id("cronSchedules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get available handler keys for the create schedule form.
 */
export const getAvailableHandlers = query({
  args: {},
  handler: async () => {
    return Object.keys(HANDLER_REGISTRY).map((key) => ({
      value: key,
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim(),
    }));
  },
});
