/**
 * Report Prompt Management
 *
 * Provides CRUD operations for AI prompt configuration used in report generation.
 * System defaults can be seeded on deploy; organizations can create overrides.
 *
 * Features:
 * - resolvePrompt internalQuery — org override first, then system default
 * - list query — system defaults + org overrides for authenticated org
 * - get query — single prompt with access control
 * - create mutation — system prompts (platform admin) or org overrides
 * - update mutation — updates sections + freeformSuffix, creates version entry
 * - remove mutation — deletes org overrides + their versions
 * - toggleActive mutation — toggle isActive flag
 */

import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { safeGetAuthUser } from "./auth";
import { getUserOrgId, requireUserOrgId } from "./authHelpers";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const sectionValidator = v.object({
  key: v.string(),
  label: v.string(),
  value: v.string(),
  fieldType: v.union(v.literal("textarea"), v.literal("text"), v.literal("select")),
  options: v.optional(v.array(v.string())),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the authenticated user is a platform admin.
 * Returns false (not throws) when not authenticated.
 */
async function isPlatformAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const user = await safeGetAuthUser(ctx);
  if (!user) return false;
  const userId = user._id as unknown as Id<"users">;
  const dbUser = await ctx.db.get(userId);
  return dbUser?.role === "admin";
}

/**
 * Get the next version number for a prompt.
 */
async function getNextVersion(ctx: MutationCtx, promptId: Id<"reportPrompts">): Promise<number> {
  const latest = await ctx.db
    .query("reportPromptVersions")
    .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
    .order("desc")
    .first();
  return (latest?.version ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// resolvePrompt — internalQuery
// ---------------------------------------------------------------------------

/**
 * Resolve the effective prompt for a given type in an org context.
 * Checks org override first, then system default, returns null if neither found.
 */
export const resolvePrompt = internalQuery({
  args: {
    type: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Check for active org override first
    if (args.organizationId) {
      const override = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_org", (q) =>
          q.eq("type", args.type).eq("organizationId", args.organizationId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (override) return override;
    }

    // Fall back to active system default
    const systemDefault = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_system", (q) =>
        q.eq("type", args.type).eq("isSystem", true)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    return systemDefault ?? null;
  },
});

// ---------------------------------------------------------------------------
// list — query
// ---------------------------------------------------------------------------

/**
 * List prompts available to the user's org: system defaults + org overrides.
 * Returns an empty array when not authenticated.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const organizationId = args.organizationId ?? (await getUserOrgId(ctx));

    // Collect all prompts and split into system defaults and org overrides
    const allPrompts = await ctx.db.query("reportPrompts").collect();
    const systemDefaults = allPrompts.filter((p) => p.isSystem);

    // Org overrides (only if user has an org)
    const orgOverrides = organizationId
      ? allPrompts.filter(
          (p) => !p.isSystem && p.organizationId === organizationId
        )
      : [];

    return { systemDefaults, orgOverrides };
  },
});

// ---------------------------------------------------------------------------
// get — query
// ---------------------------------------------------------------------------

/**
 * Get a single prompt by ID.
 * System prompts are readable by all authenticated users.
 * Org prompts are only readable by members of the owning org.
 */
export const get = query({
  args: {
    id: v.id("reportPrompts"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) return null;

    if (prompt.isSystem) {
      // System prompts are publicly readable (still require any valid context)
      return prompt;
    }

    // Org prompts: verify the caller belongs to the owning org
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId || organizationId !== prompt.organizationId) {
      return null;
    }

    return prompt;
  },
});

// ---------------------------------------------------------------------------
// create — mutation
// ---------------------------------------------------------------------------

/**
 * Create a new prompt.
 * - isSystem: true → platform admin only
 * - isSystem: false → org override, creates version entry
 * Enforces uniqueness: only one active prompt per (type, org) pair.
 */
export const create = mutation({
  args: {
    type: v.string(),
    label: v.string(),
    isSystem: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
    sections: v.array(sectionValidator),
    freeformSuffix: v.string(),
    isActive: v.optional(v.boolean()),
    changeMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await safeGetAuthUser(ctx);
    const userId = user ? (user._id as unknown as Id<"users">) : undefined;

    if (args.isSystem) {
      // Platform admin check
      const admin = await isPlatformAdmin(ctx);
      if (!admin) {
        throw new Error("Platform admin access required to create system prompts");
      }

      // Enforce uniqueness: no duplicate system prompt for same type
      const existing = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_system", (q) =>
          q.eq("type", args.type).eq("isSystem", true)
        )
        .first();
      if (existing) {
        throw new Error(`System prompt for type "${args.type}" already exists`);
      }

      const promptId = await ctx.db.insert("reportPrompts", {
        type: args.type,
        label: args.label,
        isSystem: true,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        isActive: args.isActive ?? true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      // Create initial version
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        changedBy: userId,
        changeMessage: args.changeMessage ?? "Initial version",
        createdAt: now,
      });

      return { promptId };
    }

    // Org override
    const organizationId = args.organizationId ?? (await requireUserOrgId(ctx));

    // Enforce uniqueness: only one override per (type, org) pair
    const existingOverride = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_org", (q) =>
        q.eq("type", args.type).eq("organizationId", organizationId)
      )
      .first();
    if (existingOverride) {
      throw new Error(
        `Org override for type "${args.type}" already exists. Use update instead.`
      );
    }

    const promptId = await ctx.db.insert("reportPrompts", {
      type: args.type,
      label: args.label,
      isSystem: false,
      organizationId,
      sections: args.sections,
      freeformSuffix: args.freeformSuffix,
      isActive: args.isActive ?? true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial version
    await ctx.db.insert("reportPromptVersions", {
      promptId,
      version: 1,
      sections: args.sections,
      freeformSuffix: args.freeformSuffix,
      changedBy: userId,
      changeMessage: args.changeMessage ?? "Initial version",
      createdAt: now,
    });

    return { promptId };
  },
});

// ---------------------------------------------------------------------------
// update — mutation
// ---------------------------------------------------------------------------

/**
 * Update prompt sections and/or freeformSuffix.
 * Always creates a new version entry in reportPromptVersions.
 * System prompts: platform admin only.
 * Org prompts: org members only.
 */
export const update = mutation({
  args: {
    id: v.id("reportPrompts"),
    label: v.optional(v.string()),
    sections: v.optional(v.array(sectionValidator)),
    freeformSuffix: v.optional(v.string()),
    changeMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const user = await safeGetAuthUser(ctx);
    const userId = user ? (user._id as unknown as Id<"users">) : undefined;

    if (prompt.isSystem) {
      const admin = await isPlatformAdmin(ctx);
      if (!admin) {
        throw new Error("Platform admin access required to update system prompts");
      }
    } else {
      const organizationId = await getUserOrgId(ctx);
      if (!organizationId || organizationId !== prompt.organizationId) {
        throw new Error("Access denied: prompt belongs to a different organization");
      }
    }

    const now = Date.now();
    const newSections = args.sections ?? prompt.sections;
    const newFreeformSuffix = args.freeformSuffix ?? prompt.freeformSuffix;

    const patchData: Record<string, unknown> = { updatedAt: now };
    if (args.label !== undefined) patchData.label = args.label;
    if (args.sections !== undefined) patchData.sections = newSections;
    if (args.freeformSuffix !== undefined) patchData.freeformSuffix = newFreeformSuffix;

    await ctx.db.patch(args.id, patchData);

    // Create new version entry
    const version = await getNextVersion(ctx, args.id);
    await ctx.db.insert("reportPromptVersions", {
      promptId: args.id,
      version,
      sections: newSections,
      freeformSuffix: newFreeformSuffix,
      changedBy: userId,
      changeMessage: args.changeMessage,
      createdAt: now,
    });

    return { success: true, version };
  },
});

// ---------------------------------------------------------------------------
// remove — mutation
// ---------------------------------------------------------------------------

/**
 * Delete a prompt and its version history.
 * - System prompts: platform admin only.
 * - Org prompts: org members can delete their own; platform admin can delete any.
 */
export const remove = mutation({
  args: {
    id: v.id("reportPrompts"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const admin = await isPlatformAdmin(ctx);

    if (prompt.isSystem) {
      if (!admin) {
        throw new Error("Platform admin access required to delete system prompts");
      }
    } else {
      if (!admin) {
        const organizationId = await getUserOrgId(ctx);
        if (!organizationId || organizationId !== prompt.organizationId) {
          throw new Error("Access denied: prompt belongs to a different organization");
        }
      }
    }

    // Delete all version history
    const versions = await ctx.db
      .query("reportPromptVersions")
      .withIndex("by_prompt", (q) => q.eq("promptId", args.id))
      .collect();
    await Promise.all(versions.map((v) => ctx.db.delete(v._id)));

    // Delete the prompt itself
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// toggleActive — mutation
// ---------------------------------------------------------------------------

/**
 * Toggle the isActive flag of a prompt.
 * System prompts: platform admin only.
 * Org prompts: org members only.
 */
export const toggleActive = mutation({
  args: {
    id: v.id("reportPrompts"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    if (prompt.isSystem) {
      const admin = await isPlatformAdmin(ctx);
      if (!admin) {
        throw new Error("Platform admin access required to toggle system prompts");
      }
    } else {
      const organizationId = await getUserOrgId(ctx);
      if (!organizationId || organizationId !== prompt.organizationId) {
        throw new Error("Access denied: prompt belongs to a different organization");
      }
    }

    await ctx.db.patch(args.id, {
      isActive: !prompt.isActive,
      updatedAt: Date.now(),
    });

    return { success: true, isActive: !prompt.isActive };
  },
});
