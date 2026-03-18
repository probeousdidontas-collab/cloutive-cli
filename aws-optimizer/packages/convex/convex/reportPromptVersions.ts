import { v } from "convex/values";
import { query } from "./_generated/server";
import { safeGetAuthUser } from "./auth";

/**
 * List versions for a prompt, newest first.
 */
export const listByPrompt = query({
  args: {
    promptId: v.id("reportPrompts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { promptId, limit }) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) return [];

    const versions = await ctx.db
      .query("reportPromptVersions")
      .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
      .order("desc")
      .take(limit ?? 20);
    return versions;
  },
});

/**
 * Get a specific version by prompt + version number.
 */
export const getByVersion = query({
  args: {
    promptId: v.id("reportPrompts"),
    version: v.number(),
  },
  handler: async (ctx, { promptId, version }) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("reportPromptVersions")
      .withIndex("by_prompt_and_version", (q) =>
        q.eq("promptId", promptId).eq("version", version)
      )
      .first();
  },
});
