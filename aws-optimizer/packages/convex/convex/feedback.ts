/**
 * Feedback API Wrapper
 *
 * These functions wrap the @fatagnus/convex-feedback component to expose
 * its functionality to the client. Components expose "internal" functions
 * that can only be called from server-side code, so we need these wrappers
 * to make them callable from the frontend.
 */

import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

// Bug report severity and status validators (matching the component's schema)
const bugSeverityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical")
);

const reporterTypeValidator = v.union(
  v.literal("staff"),
  v.literal("customer")
);

// Feedback validators
const feedbackTypeValidator = v.union(
  v.literal("feature_request"),
  v.literal("change_request"),
  v.literal("general")
);

const feedbackPriorityValidator = v.union(
  v.literal("nice_to_have"),
  v.literal("important"),
  v.literal("critical")
);

/**
 * Create a bug report
 */
export const createBugReport = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    severity: bugSeverityValidator,
    reporterType: reporterTypeValidator,
    reporterId: v.string(),
    reporterEmail: v.string(),
    reporterName: v.string(),
    url: v.string(),
    route: v.optional(v.string()),
    browserInfo: v.string(),
    consoleErrors: v.optional(v.string()),
    screenshotStorageId: v.optional(v.id("_storage")),
    viewportWidth: v.number(),
    viewportHeight: v.number(),
    networkState: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.bugReports.create, {
      ...args,
      // Pass environment variables to the component
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL,
    });
  },
});

/**
 * Generate upload URL for bug report screenshots
 */
export const generateBugReportUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(components.feedback.bugReports.generateUploadUrl, {});
  },
});

/**
 * Create feedback
 */
export const createFeedback = mutation({
  args: {
    type: feedbackTypeValidator,
    title: v.string(),
    description: v.string(),
    priority: feedbackPriorityValidator,
    reporterType: reporterTypeValidator,
    reporterId: v.string(),
    reporterEmail: v.string(),
    reporterName: v.string(),
    url: v.string(),
    route: v.optional(v.string()),
    browserInfo: v.string(),
    consoleErrors: v.optional(v.string()),
    screenshotStorageId: v.optional(v.id("_storage")),
    viewportWidth: v.number(),
    viewportHeight: v.number(),
    networkState: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.feedback.create, {
      ...args,
      // Pass environment variables to the component
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL,
    });
  },
});

/**
 * Generate upload URL for feedback screenshots
 */
export const generateFeedbackUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(components.feedback.feedback.generateUploadUrl, {});
  },
});

// Bug status validator
const bugStatusValidator = v.union(
  v.literal("open"),
  v.literal("in-progress"),
  v.literal("resolved"),
  v.literal("closed")
);

// Feedback status validator
const feedbackStatusValidator = v.union(
  v.literal("open"),
  v.literal("under_review"),
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("declined")
);

/**
 * List all bug reports
 */
export const listBugReports = query({
  args: {
    status: v.optional(bugStatusValidator),
    severity: v.optional(bugSeverityValidator),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.bugReports.list, {
      status: args.status,
      severity: args.severity,
      limit: args.limit ?? 100,
      includeArchived: args.includeArchived ?? false,
    });
  },
});

/**
 * Get a single bug report
 */
export const getBugReport = query({
  args: {
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.bugReports.get, {
      reportId: args.reportId,
    });
  },
});

/**
 * Get bug report screenshot URL
 */
export const getBugReportScreenshotUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.bugReports.getScreenshotUrl, {
      storageId: args.storageId,
    });
  },
});

/**
 * Update bug report status
 */
export const updateBugReportStatus = mutation({
  args: {
    reportId: v.string(),
    status: bugStatusValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.bugReports.updateStatus, {
      reportId: args.reportId,
      status: args.status,
    });
  },
});

/**
 * Archive a bug report
 */
export const archiveBugReport = mutation({
  args: {
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.bugReports.archive, {
      reportId: args.reportId,
    });
  },
});

/**
 * List all feedback
 */
export const listFeedback = query({
  args: {
    status: v.optional(feedbackStatusValidator),
    priority: v.optional(feedbackPriorityValidator),
    type: v.optional(feedbackTypeValidator),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.feedback.list, {
      status: args.status,
      priority: args.priority,
      type: args.type,
      limit: args.limit ?? 100,
      includeArchived: args.includeArchived ?? false,
    });
  },
});

/**
 * Get a single feedback item
 */
export const getFeedbackItem = query({
  args: {
    feedbackId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.feedback.get, {
      feedbackId: args.feedbackId,
    });
  },
});

/**
 * Get feedback screenshot URL
 */
export const getFeedbackScreenshotUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.feedback.feedback.getScreenshotUrl, {
      storageId: args.storageId,
    });
  },
});

/**
 * Update feedback status
 */
export const updateFeedbackStatus = mutation({
  args: {
    feedbackId: v.string(),
    status: feedbackStatusValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.feedback.updateStatus, {
      feedbackId: args.feedbackId,
      status: args.status,
    });
  },
});

/**
 * Archive a feedback item
 */
export const archiveFeedback = mutation({
  args: {
    feedbackId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.feedback.feedback.archive, {
      feedbackId: args.feedbackId,
    });
  },
});
