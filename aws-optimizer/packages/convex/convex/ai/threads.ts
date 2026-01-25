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
import { requireAuth, getAuthenticatedUserId } from "../functions";

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
 * Returns empty page if user is not authenticated.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    
    // Return empty page if not authenticated
    if (!userId) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }

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
 * Returns null if user is not authenticated or thread not found.
 */
export const get = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    
    // Return null if not authenticated
    if (!userId) {
      return null;
    }

    try {
      const thread = await ctx.runQuery(components.agent.threads.getThread, {
        threadId: args.threadId as never,
      });
      if (!thread) return null;
      
      // Verify ownership
      if (thread.userId !== userId) {
        return null; // Don't reveal thread exists
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
