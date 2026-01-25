/**
 * AI Chat Handlers
 *
 * Implements US-018: Implement AI chat handlers and thread management
 *
 * Provides chat functionality:
 * - sendMessage: Save user message and schedule AI response
 * - generateResponse: Internal action to generate AI response
 * - streamMessage: Action for streaming responses
 * - listThreadMessages: Query to list messages in a thread
 */

import { v } from "convex/values";
import { action, internalAction, query, mutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { awsCostAgent } from "./awsCostAgent";
import { requireAuth, requireAuthAction } from "../functions";
import { listMessages, saveMessage } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";

/**
 * Send a message to the AI assistant.
 * Saves the user message and schedules the AI to generate a response.
 */
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
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
      throw new Error("Unauthorized: Cannot send message to another user's thread");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt: args.prompt,
    });

    await ctx.scheduler.runAfter(0, internal.ai.chat.generateResponse, {
      threadId: args.threadId,
      promptMessageId: messageId,
      userId,
    });

    return { success: true, messageId };
  },
});

/**
 * Generate AI response for a thread.
 * Internal action called by sendMessage.
 */
export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("Starting agent generation for thread:", args.threadId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (awsCostAgent as any).generateText(
        ctx,
        { threadId: args.threadId, userId: args.userId },
        { 
          promptMessageId: args.promptMessageId,
          maxSteps: 10,
        }
      );
      console.log("Agent response generated:", result?.text?.slice(0, 100));
    } catch (error) {
      console.error("Agent generation failed:", error);
      throw error;
    }
  },
});

/**
 * Stream a message to the AI assistant.
 * Returns the complete response after streaming.
 */
export const streamMessage = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthAction(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (awsCostAgent as any).streamText(
      ctx,
      { threadId: args.threadId, userId },
      { prompt: args.prompt }
    );

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    return { text: fullText };
  },
});

/**
 * List messages in a thread.
 * Supports pagination.
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
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
      throw new Error("Unauthorized: Cannot view another user's messages");
    }

    const messages = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    return messages;
  },
});
