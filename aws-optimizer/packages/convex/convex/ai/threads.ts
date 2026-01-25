/**
 * AI Thread Management
 *
 * Implements US-018: Implement AI chat handlers and thread management
 *
 * Provides thread operations:
 * - create: Create a new chat thread
 * - list: List user's threads with pagination
 * - get: Get a single thread by ID
 * - remove: Delete a thread
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { components } from "../_generated/api";
import { requireAuth } from "../functions";

/**
 * Create a new chat thread.
 */
export const create = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const thread = await ctx.runMutation(components.agent.threads.createThread, {
      userId,
      title: args.title || "New conversation",
    });

    return { threadId: thread._id };
  },
});

/**
 * List user's chat threads with pagination.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId, paginationOpts: args.paginationOpts }
    );

    return {
      page: threads.page.map((t) => ({
        id: t._id,
        title: t.title,
        createdAt: t._creationTime,
        status: t.status,
      })),
      isDone: threads.isDone,
      continueCursor: threads.continueCursor,
    };
  },
});

/**
 * Get a single thread by ID.
 */
export const get = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    try {
      const thread = await ctx.runQuery(components.agent.threads.getThread, {
        threadId: args.threadId as never,
      });
      if (!thread) return null;
      
      // Verify ownership
      if (thread.userId !== userId) {
        throw new Error("Unauthorized: Cannot access another user's thread");
      }
      
      return {
        id: thread._id,
        userId: thread.userId,
        title: thread.title,
        status: thread.status,
        createdAt: thread._creationTime,
      };
    } catch {
      return null;
    }
  },
});

/**
 * Delete a chat thread.
 */
export const remove = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId as never,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== userId) {
      throw new Error("Unauthorized: Cannot delete another user's thread");
    }

    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: args.threadId as never,
    });

    return { success: true };
  },
});
