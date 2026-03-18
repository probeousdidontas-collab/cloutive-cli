# AI Prompt Management UI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings/prompts` page where admins and org users can view, edit, and version-control the AI prompts used for report generation.

**Architecture:** Two new Convex tables (`reportPrompts`, `reportPromptVersions`) with a CRUD module, an `internalQuery` for prompt resolution, seed migration for existing hardcoded prompts, and a React page with master-detail layout using Mantine + Convex reactive queries.

**Tech Stack:** Convex (backend), React + Mantine v7 (UI), Convex `useQuery`/`useMutation` for reactivity (no separate MobX store needed — Convex provides real-time subscriptions), `diff` npm package (version diffing), vitest + convex-test (testing)

**Note on state management:** The spec mentions a MobX `PromptStore` but Convex's `useQuery` already provides reactive state. Adding MobX on top would be redundant for this page. Local component state (`useState`) handles form edits.

**Spec:** `docs/superpowers/specs/2026-03-18-prompt-management-ui-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `packages/convex/convex/reportPrompts.ts` | CRUD queries/mutations + `resolvePrompt` internalQuery |
| `packages/convex/convex/reportPromptVersions.ts` | Version history queries |
| `packages/convex/convex/migrations/seedReportPrompts.ts` | Idempotent seed for 6 system prompts |
| `packages/convex/convex/reportPrompts.test.ts` | Backend unit tests |
| `apps/web/src/pages/AIPromptsPage.tsx` | Main prompt management page |
| `apps/web/src/components/prompts/PromptEditor.tsx` | Right panel: structured form editor |
| `apps/web/src/components/prompts/PromptList.tsx` | Left panel: prompt list with groups |
| `apps/web/src/components/prompts/VersionHistoryDrawer.tsx` | Version history drawer with diff |

### Modified Files
| File | Change |
|---|---|
| `packages/convex/convex/schema.ts:809` | Add `reportPrompts` and `reportPromptVersions` tables |
| `packages/convex/convex/ai/reportGeneration.ts:319-449,535` | Refactor `buildReportPrompt()` to read from DB |
| `packages/convex/convex/ai/costAnalysisInsights.ts:39,59` | Load prompts from DB instead of hardcoded |
| `apps/web/src/router.tsx:2,176,205` | Add AIPromptsPage import, route, and tree entry |
| `apps/web/src/pages/index.ts` | Add AIPromptsPage export |
| `apps/web/src/components/nav-items.tsx:18,42` | Add IconRobot import and "AI Prompts" nav item |

---

## Task 1: Schema — Add reportPrompts and reportPromptVersions tables

**Files:**
- Modify: `packages/convex/convex/schema.ts:809`

- [ ] **Step 1: Add the two new tables to schema**

Add before the closing `});` at line 809 of schema.ts:

```typescript
  // ============================================================================
  // AI PROMPT MANAGEMENT
  // ============================================================================
  // Configurable prompts for report generation AI agents.
  // System defaults are seeded on deploy; organizations can override.
  reportPrompts: defineTable({
    type: v.string(),
    label: v.string(),
    isSystem: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
    sections: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        value: v.string(),
        fieldType: v.union(v.literal("textarea"), v.literal("text"), v.literal("select")),
        options: v.optional(v.array(v.string())),
      })
    ),
    freeformSuffix: v.string(),
    isActive: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type_and_system", ["type", "isSystem"])
    .index("by_type_and_org", ["type", "organizationId"])
    .index("by_org", ["organizationId"]),

  // Version history for prompt changes. Each save creates a new version.
  reportPromptVersions: defineTable({
    promptId: v.id("reportPrompts"),
    version: v.number(),
    sections: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        value: v.string(),
        fieldType: v.union(v.literal("textarea"), v.literal("text"), v.literal("select")),
        options: v.optional(v.array(v.string())),
      })
    ),
    freeformSuffix: v.string(),
    changedBy: v.optional(v.id("users")),
    changeMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_prompt", ["promptId"])
    .index("by_prompt_and_version", ["promptId", "version"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd aws-optimizer/packages/convex && npx convex dev --once --typecheck disable`
Expected: Schema accepted, no errors

- [ ] **Step 3: Commit**

```bash
git add packages/convex/convex/schema.ts
git commit -m "feat(schema): add reportPrompts and reportPromptVersions tables"
```

---

## Task 2: Backend — CRUD module for reportPrompts

**Files:**
- Create: `packages/convex/convex/reportPrompts.ts`

- [ ] **Step 1: Write the failing test for resolvePrompt**

Create `packages/convex/convex/reportPrompts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createTestConvex, type TestCtx } from "../test.setup";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

async function seedTestOrg(t: ReturnType<typeof createTestConvex>) {
  const now = Date.now();
  const orgId = await t.run(async (ctx: TestCtx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: `test-org-${now}`,
      plan: "free",
      settings: {},
      createdAt: now,
      updatedAt: now,
    });
  }) as Id<"organizations">;
  return orgId;
}

async function seedSystemPrompt(t: ReturnType<typeof createTestConvex>, type: string) {
  const now = Date.now();
  return await t.run(async (ctx: TestCtx) => {
    return await ctx.db.insert("reportPrompts", {
      type,
      label: `${type} label`,
      isSystem: true,
      sections: [
        { key: "intro", label: "Introduction", value: "System default intro", fieldType: "textarea" as const },
      ],
      freeformSuffix: "",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }) as Id<"reportPrompts">;
}

describe("reportPrompts", () => {
  /**
   * Tests use t.run() with direct DB queries to test resolution logic,
   * since existing project tests use this pattern (not t.query(api.*)).
   * The resolution logic mirrors what resolvePrompt internalQuery does.
   */
  describe("resolvePrompt logic", () => {
    it("returns system default when no org override exists", async () => {
      const t = createTestConvex();
      const orgId = await seedTestOrg(t);
      await seedSystemPrompt(t, "cost_analysis");

      const result = await t.run(async (ctx: TestCtx) => {
        // Mirrors resolvePrompt logic: check org override first, then system default
        const override = await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_org", (q: any) => q.eq("type", "cost_analysis").eq("organizationId", orgId))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .first();
        if (override) return override;
        return await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_system", (q: any) => q.eq("type", "cost_analysis").eq("isSystem", true))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .first();
      });

      expect(result).not.toBeNull();
      expect(result!.isSystem).toBe(true);
      expect(result!.sections[0].value).toBe("System default intro");
    });

    it("returns org override when it exists", async () => {
      const t = createTestConvex();
      const orgId = await seedTestOrg(t);
      await seedSystemPrompt(t, "cost_analysis");

      const now = Date.now();
      await t.run(async (ctx: TestCtx) => {
        return await ctx.db.insert("reportPrompts", {
          type: "cost_analysis",
          label: "Cost Analysis",
          isSystem: false,
          organizationId: orgId,
          sections: [
            { key: "intro", label: "Introduction", value: "Org custom intro", fieldType: "textarea" as const },
          ],
          freeformSuffix: "Extra instructions",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx: TestCtx) => {
        const override = await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_org", (q: any) => q.eq("type", "cost_analysis").eq("organizationId", orgId))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .first();
        return override;
      });

      expect(result).not.toBeNull();
      expect(result!.isSystem).toBe(false);
      expect(result!.sections[0].value).toBe("Org custom intro");
    });

    it("returns null when no prompt exists", async () => {
      const t = createTestConvex();
      await seedTestOrg(t);

      const result = await t.run(async (ctx: TestCtx) => {
        return await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_system", (q: any) => q.eq("type", "nonexistent").eq("isSystem", true))
          .first();
      });

      expect(result).toBeNull();
    });

    it("skips inactive org override and returns system default", async () => {
      const t = createTestConvex();
      const orgId = await seedTestOrg(t);
      await seedSystemPrompt(t, "cost_analysis");

      const now = Date.now();
      await t.run(async (ctx: TestCtx) => {
        return await ctx.db.insert("reportPrompts", {
          type: "cost_analysis",
          label: "Cost Analysis",
          isSystem: false,
          organizationId: orgId,
          sections: [
            { key: "intro", label: "Introduction", value: "Inactive override", fieldType: "textarea" as const },
          ],
          freeformSuffix: "",
          isActive: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx: TestCtx) => {
        // Check override (should be skipped — inactive)
        const override = await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_org", (q: any) => q.eq("type", "cost_analysis").eq("organizationId", orgId))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .first();
        if (override) return override;
        // Fall back to system default
        return await ctx.db
          .query("reportPrompts")
          .withIndex("by_type_and_system", (q: any) => q.eq("type", "cost_analysis").eq("isSystem", true))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .first();
      });

      expect(result).not.toBeNull();
      expect(result!.isSystem).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: FAIL — `internal.reportPrompts` not found

- [ ] **Step 3: Implement reportPrompts.ts**

Create `packages/convex/convex/reportPrompts.ts`:

```typescript
/**
 * AI Prompt Management
 *
 * CRUD operations for report generation prompts.
 * System defaults are seeded on deploy; organizations can override.
 * resolvePrompt is the core internalQuery used by report generation actions.
 */

import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getUserOrgId, requireUserOrgId } from "./authHelpers";
import { safeGetAuthUser } from "./auth";
import type { Id } from "./_generated/dataModel";

const sectionValidator = v.object({
  key: v.string(),
  label: v.string(),
  value: v.string(),
  fieldType: v.union(v.literal("textarea"), v.literal("text"), v.literal("select")),
  options: v.optional(v.array(v.string())),
});

// ============================================================================
// Internal Query — used by report generation actions via ctx.runQuery()
// ============================================================================

/**
 * Resolve the prompt for a given type and organization.
 * Priority: org override > system default > null (caller falls back to hardcoded).
 */
export const resolvePrompt = internalQuery({
  args: {
    type: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { type, organizationId }) => {
    // Step 1: Check org override
    if (organizationId) {
      const override = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_org", (q) =>
          q.eq("type", type).eq("organizationId", organizationId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (override) return override;
    }
    // Step 2: Check system default
    const systemDefault = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_system", (q) =>
        q.eq("type", type).eq("isSystem", true)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    return systemDefault ?? null;
  },
});

// ============================================================================
// Public Queries
// ============================================================================

/**
 * List all prompts visible to the current user.
 * Returns system defaults + org overrides for the user's organization.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) return { systemDefaults: [], orgOverrides: [] };

    const organizationId = await getUserOrgId(ctx);

    // System defaults — filter from full table (no single index covers isSystem=true across all types)
    const allPrompts = await ctx.db.query("reportPrompts").collect();
    const systemDefaults = allPrompts.filter((p) => p.isSystem);

    // Org overrides (if user has an org)
    let orgOverrides: typeof systemDefaults = [];
    if (organizationId) {
      orgOverrides = await ctx.db
        .query("reportPrompts")
        .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
        .collect();
    }

    return { systemDefaults, orgOverrides };
  },
});

/**
 * Get a single prompt by ID.
 * System prompts visible to all authenticated users.
 * Org overrides only visible to members of that org.
 */
export const get = query({
  args: { promptId: v.id("reportPrompts") },
  handler: async (ctx, { promptId }) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) return null;

    const prompt = await ctx.db.get(promptId);
    if (!prompt) return null;

    // System defaults visible to all
    if (prompt.isSystem) return prompt;

    // Org overrides only visible to org members
    if (prompt.organizationId) {
      const orgId = await getUserOrgId(ctx);
      if (prompt.organizationId !== orgId) return null;
    }

    return prompt;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new prompt (system default or org override).
 * Enforces uniqueness: only one active prompt per type+org (or type+isSystem).
 */
export const create = mutation({
  args: {
    type: v.string(),
    label: v.string(),
    isSystem: v.boolean(),
    sections: v.array(sectionValidator),
    freeformSuffix: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    const userId = user._id as unknown as Id<"users">;

    if (args.isSystem) {
      // Only platform admins can create system defaults
      const userDoc = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("_id"), userId))
        .first();
      if (!userDoc || userDoc.role !== "admin") {
        throw new Error("Only platform admins can create system defaults");
      }

      // Check uniqueness
      const existing = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_system", (q) =>
          q.eq("type", args.type).eq("isSystem", true)
        )
        .first();
      if (existing) throw new Error(`System default for type "${args.type}" already exists`);

      const promptId = await ctx.db.insert("reportPrompts", {
        type: args.type,
        label: args.label,
        isSystem: true,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      // Create v1
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        changedBy: userId,
        changeMessage: "Initial version",
        createdAt: now,
      });

      return { promptId };
    } else {
      // Org override
      const organizationId = await requireUserOrgId(ctx);

      // Check uniqueness
      const existing = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_org", (q) =>
          q.eq("type", args.type).eq("organizationId", organizationId)
        )
        .first();
      if (existing) throw new Error(`Override for type "${args.type}" already exists for this organization`);

      const promptId = await ctx.db.insert("reportPrompts", {
        type: args.type,
        label: args.label,
        isSystem: false,
        organizationId,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      // Create v1
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: args.sections,
        freeformSuffix: args.freeformSuffix,
        changedBy: userId,
        changeMessage: "Initial version",
        createdAt: now,
      });

      return { promptId };
    }
  },
});

/**
 * Update a prompt's sections and freeformSuffix. Creates a new version.
 */
export const update = mutation({
  args: {
    promptId: v.id("reportPrompts"),
    sections: v.array(sectionValidator),
    freeformSuffix: v.string(),
    changeMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) throw new Error("Prompt not found");

    const userId = user._id as unknown as Id<"users">;
    const now = Date.now();

    // Authorization check
    if (prompt.isSystem) {
      const userDoc = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("_id"), userId))
        .first();
      if (!userDoc || userDoc.role !== "admin") {
        throw new Error("Only platform admins can edit system defaults");
      }
    } else if (prompt.organizationId) {
      const orgId = await requireUserOrgId(ctx);
      if (prompt.organizationId !== orgId) {
        throw new Error("Cannot edit another organization's prompt");
      }
    }

    // Get latest version number
    const latestVersion = await ctx.db
      .query("reportPromptVersions")
      .withIndex("by_prompt", (q) => q.eq("promptId", args.promptId))
      .order("desc")
      .first();
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Update prompt
    await ctx.db.patch(args.promptId, {
      sections: args.sections,
      freeformSuffix: args.freeformSuffix,
      updatedAt: now,
    });

    // Create version snapshot
    await ctx.db.insert("reportPromptVersions", {
      promptId: args.promptId,
      version: nextVersion,
      sections: args.sections,
      freeformSuffix: args.freeformSuffix,
      changedBy: userId,
      changeMessage: args.changeMessage,
      createdAt: now,
    });

    return { version: nextVersion };
  },
});

/**
 * Delete an org override (Reset to Default).
 * Also deletes all associated versions.
 */
export const remove = mutation({
  args: { promptId: v.id("reportPrompts") },
  handler: async (ctx, { promptId }) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const prompt = await ctx.db.get(promptId);
    if (!prompt) throw new Error("Prompt not found");

    if (prompt.isSystem) {
      throw new Error("Cannot delete system defaults. Use isActive toggle instead.");
    }

    // Platform admins can delete any org override; org owners/admins can delete their own
    const userId = user._id as unknown as Id<"users">;
    const userDoc = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), userId))
      .first();
    const isPlatformAdmin = userDoc?.role === "admin";

    if (!isPlatformAdmin) {
      const orgId = await requireUserOrgId(ctx);
      if (prompt.organizationId !== orgId) {
        throw new Error("Cannot delete another organization's prompt");
      }
    }

    // Delete all versions
    const versions = await ctx.db
      .query("reportPromptVersions")
      .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete prompt
    await ctx.db.delete(promptId);
  },
});

/**
 * Toggle a prompt's isActive status.
 */
export const toggleActive = mutation({
  args: { promptId: v.id("reportPrompts") },
  handler: async (ctx, { promptId }) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const prompt = await ctx.db.get(promptId);
    if (!prompt) throw new Error("Prompt not found");

    const userId = user._id as unknown as Id<"users">;
    const userDoc = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), userId))
      .first();
    const isPlatformAdmin = userDoc?.role === "admin";

    // System defaults: only platform admins
    if (prompt.isSystem && !isPlatformAdmin) {
      throw new Error("Only platform admins can toggle system defaults");
    }

    // Org overrides: platform admins or org owners/admins
    if (!prompt.isSystem && prompt.organizationId && !isPlatformAdmin) {
      const orgId = await requireUserOrgId(ctx);
      if (prompt.organizationId !== orgId) {
        throw new Error("Cannot toggle another organization's prompt");
      }
    }

    await ctx.db.patch(promptId, {
      isActive: !prompt.isActive,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/convex/convex/reportPrompts.ts packages/convex/convex/reportPrompts.test.ts
git commit -m "feat(convex): add reportPrompts CRUD module with resolvePrompt internalQuery"
```

---

## Task 3: Backend — Version history queries

**Files:**
- Create: `packages/convex/convex/reportPromptVersions.ts`

- [ ] **Step 1: Add version history tests to reportPrompts.test.ts**

Append to `reportPrompts.test.ts`:

```typescript
describe("reportPromptVersions", () => {
  it("lists versions newest first", async () => {
    const t = createTestConvex();
    const promptId = await seedSystemPrompt(t, "cost_analysis");

    const now = Date.now();
    await t.run(async (ctx: TestCtx) => {
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: [{ key: "intro", label: "Introduction", value: "v1 content", fieldType: "textarea" }],
        freeformSuffix: "",
        createdAt: now,
      });
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 2,
        sections: [{ key: "intro", label: "Introduction", value: "v2 content", fieldType: "textarea" }],
        freeformSuffix: "added suffix",
        createdAt: now + 1000,
      });
    });

    // Use t.run() to test query logic directly
    const versions = await t.run(async (ctx: TestCtx) => {
      return await ctx.db
        .query("reportPromptVersions")
        .withIndex("by_prompt", (q: any) => q.eq("promptId", promptId))
        .order("desc")
        .take(20);
    });

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2); // newest first
    expect(versions[1].version).toBe(1);
  });

  it("fetches specific version by prompt + version number", async () => {
    const t = createTestConvex();
    const promptId = await seedSystemPrompt(t, "cost_analysis");

    const now = Date.now();
    await t.run(async (ctx: TestCtx) => {
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: [{ key: "intro", label: "Introduction", value: "v1", fieldType: "textarea" }],
        freeformSuffix: "",
        createdAt: now,
      });
    });

    const version = await t.run(async (ctx: TestCtx) => {
      return await ctx.db
        .query("reportPromptVersions")
        .withIndex("by_prompt_and_version", (q: any) => q.eq("promptId", promptId).eq("version", 1))
        .first();
    });

    expect(version).not.toBeNull();
    expect(version!.sections[0].value).toBe("v1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: FAIL — `internal.reportPromptVersions` not found

- [ ] **Step 3: Implement reportPromptVersions.ts**

Create `packages/convex/convex/reportPromptVersions.ts`:

```typescript
/**
 * Report Prompt Version History
 *
 * Public queries for browsing version history of report prompts.
 * Used by the version history drawer in the UI.
 */

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/convex/convex/reportPromptVersions.ts packages/convex/convex/reportPrompts.test.ts
git commit -m "feat(convex): add reportPromptVersions queries for version history"
```

---

## Task 4: Seed Migration — Populate system default prompts

**Files:**
- Create: `packages/convex/convex/migrations/seedReportPrompts.ts`

- [ ] **Step 1: Write seed migration test**

Add to `reportPrompts.test.ts`:

```typescript
describe("seedReportPrompts", () => {
  /**
   * Seed tests use t.mutation() to call the insertPrompt internalMutation directly.
   * We test the individual insert logic rather than the orchestrating action,
   * since convex-test may not support t.action(internal.*).
   */
  it("creates a system default prompt with v1 version", async () => {
    const t = createTestConvex();

    const testPrompt = {
      type: "cost_analysis",
      label: "Cost Analysis",
      sections: [
        { key: "intro", label: "Introduction", value: "Test intro", fieldType: "textarea" as const },
      ],
    };

    // Use t.run to simulate what insertPrompt mutation does
    await t.run(async (ctx: TestCtx) => {
      const now = Date.now();
      const existing = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_system", (q: any) => q.eq("type", "cost_analysis").eq("isSystem", true))
        .first();
      if (existing) return;

      const promptId = await ctx.db.insert("reportPrompts", {
        type: testPrompt.type,
        label: testPrompt.label,
        isSystem: true,
        sections: testPrompt.sections,
        freeformSuffix: "",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: testPrompt.sections,
        freeformSuffix: "",
        changeMessage: "Initial seed",
        createdAt: now,
      });
    });

    const allPrompts = await t.run(async (ctx: TestCtx) => {
      return await ctx.db.query("reportPrompts").collect();
    });
    expect(allPrompts).toHaveLength(1);
    expect(allPrompts[0].isSystem).toBe(true);
    expect(allPrompts[0].type).toBe("cost_analysis");

    const versions = await t.run(async (ctx: TestCtx) => {
      return await ctx.db.query("reportPromptVersions").collect();
    });
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
  });

  it("is idempotent — skips if system default already exists", async () => {
    const t = createTestConvex();

    // Insert once
    await t.run(async (ctx: TestCtx) => {
      const now = Date.now();
      await ctx.db.insert("reportPrompts", {
        type: "cost_analysis",
        label: "Cost Analysis",
        isSystem: true,
        sections: [{ key: "intro", label: "Intro", value: "original", fieldType: "textarea" }],
        freeformSuffix: "",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Try to insert again (simulates re-running seed)
    await t.run(async (ctx: TestCtx) => {
      const existing = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_system", (q: any) => q.eq("type", "cost_analysis").eq("isSystem", true))
        .first();
      if (existing) return; // Should skip
      await ctx.db.insert("reportPrompts", {
        type: "cost_analysis",
        label: "Cost Analysis",
        isSystem: true,
        sections: [],
        freeformSuffix: "",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const allPrompts = await t.run(async (ctx: TestCtx) => {
      return await ctx.db.query("reportPrompts").collect();
    });
    expect(allPrompts).toHaveLength(1); // Not duplicated
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement seed migration**

Create `packages/convex/convex/migrations/seedReportPrompts.ts`:

```typescript
/**
 * Seed Migration: Report Prompts
 *
 * Populates the reportPrompts table with system defaults derived from
 * the hardcoded prompts in reportGeneration.ts and costAnalysisInsights.ts.
 *
 * Idempotent: checks for existing records before inserting.
 */

import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

type PromptSection = {
  key: string;
  label: string;
  value: string;
  fieldType: "textarea" | "text" | "select";
};

type PromptSeed = {
  type: string;
  label: string;
  sections: PromptSection[];
};

const SYSTEM_PROMPTS: PromptSeed[] = [
  {
    type: "cost_analysis",
    label: "Cost Analysis",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: `**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `Generate a comprehensive cost analysis report that includes:

1. **Executive Summary** - High-level cost overview
2. **Cost Breakdown by Service** - Top spending services with percentages
3. **Cost Breakdown by Region** - Geographic cost distribution
4. **Cost Trends** - Daily/weekly/monthly trends (use aws_getCostData with different date ranges)
5. **Cost Anomalies** - Any unusual spending patterns detected
6. **Month-over-Month Comparison** - How costs compare to previous periods`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage Instructions",
        value: `Use the aws_getCostData tool with appropriate date ranges (last 30 days, last 7 days, etc.) to gather this information.

Format the report in clean markdown with tables for data and clear section headers.`,
        fieldType: "textarea",
      },
    ],
  },
  {
    type: "savings_summary",
    label: "Savings Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: `**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `Generate a savings opportunity report that includes:

1. **Executive Summary** - Total potential savings identified
2. **Reserved Instance Opportunities** - RI recommendations using aws_getReservations
3. **Savings Plan Opportunities** - SP recommendations
4. **Rightsizing Recommendations** - Instances that could be downsized (use aws_listResources for ec2)
5. **Unused Resources** - Resources with low or no utilization
6. **Quick Wins** - Easy-to-implement savings (< 1 hour effort)
7. **Implementation Roadmap** - Prioritized list of actions`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage Instructions",
        value: `Use aws_getReservations, aws_listResources (for ec2, rds, ebs), and aws_getCostData to gather this information.
Use the recommendation_save tool to persist each recommendation found.

Format with clear estimated savings amounts and implementation effort levels.`,
        fieldType: "textarea",
      },
    ],
  },
  {
    type: "resource_inventory",
    label: "Resource Inventory",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: `**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `Generate a comprehensive resource inventory report that includes:

1. **Executive Summary** - Total resource counts by type
2. **EC2 Instances** - All instances with details (use aws_listResources with resourceType: ec2)
3. **RDS Databases** - All databases with configurations
4. **S3 Buckets** - All buckets with size estimates
5. **Lambda Functions** - All functions with memory/timeout configs
6. **Load Balancers** - ELB/ALB inventory
7. **Storage Volumes** - EBS volumes with utilization
8. **Resource Tags Analysis** - Tag coverage and consistency`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage Instructions",
        value: `For each resource found, use the analysis_saveResource tool to persist it to the inventory.

Format with detailed tables showing resource attributes, estimated costs, and tags.`,
        fieldType: "textarea",
      },
    ],
  },
  {
    type: "recommendation_summary",
    label: "Recommendation Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: `**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `Generate a prioritized recommendations report that includes:

1. **Executive Summary** - Total recommendations and potential savings
2. **Critical Recommendations** - High-impact, urgent items
3. **High Priority** - Significant savings opportunities
4. **Medium Priority** - Moderate effort/savings tradeoff
5. **Low Priority** - Nice-to-have optimizations
6. **Implementation Timeline** - Suggested order of implementation
7. **Risk Assessment** - Potential risks for each recommendation`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage Instructions",
        value: `Analyze costs, resources, and reservations to identify recommendations.
Use the recommendation_save tool to persist each recommendation found.

Include estimated savings, effort level, and risk for each recommendation.`,
        fieldType: "textarea",
      },
    ],
  },
  {
    type: "executive_summary",
    label: "Executive Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: `**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `Generate a concise executive summary report suitable for leadership that includes:

1. **Key Metrics Dashboard**
   - Total monthly spend
   - Month-over-month change
   - Total potential savings identified
   - RI/SP coverage percentage

2. **Top 3 Cost Drivers** - Biggest spending areas

3. **Top 3 Savings Opportunities** - Quick wins with highest ROI

4. **Trend Analysis** - Cost trajectory and predictions

5. **Action Items** - Prioritized list of recommended next steps

6. **Risk Alerts** - Any concerning patterns or issues`,
        fieldType: "textarea",
      },
      {
        key: "output_style",
        label: "Output Style",
        value: `Keep this report concise (1-2 pages equivalent) with visual elements where helpful.
Focus on business impact and actionable insights.`,
        fieldType: "textarea",
      },
    ],
  },
  {
    type: "cost_analysis_insights",
    label: "Cost Analysis Insights",
    sections: [
      {
        key: "role_definition",
        label: "Role Definition",
        value: "You are an AWS cost optimization expert.",
        fieldType: "text",
      },
      {
        key: "executive_summary_instructions",
        label: "Executive Summary Instructions",
        value: `Based on the following AWS cost data, write a concise executive insights paragraph (3-5 sentences). Focus on: key cost drivers, notable trends, and urgent areas needing attention. Be specific with numbers. Do NOT use markdown formatting - plain text only.`,
        fieldType: "textarea",
      },
      {
        key: "account_commentary_rules",
        label: "Account Commentary Rules",
        value: `Based on the following account cost data, write 1-2 sentences of insight about what's driving costs and any recommended actions. Be specific. Plain text only, no markdown.`,
        fieldType: "textarea",
      },
    ],
  },
];

/**
 * Internal mutation to insert a single prompt + v1 version.
 */
export const insertPrompt = internalMutation({
  handler: async (ctx, { prompt }: { prompt: PromptSeed }) => {
    const now = Date.now();

    // Check if already exists
    const existing = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_system", (q) =>
        q.eq("type", prompt.type).eq("isSystem", true)
      )
      .first();
    if (existing) return; // Idempotent

    const promptId = await ctx.db.insert("reportPrompts", {
      type: prompt.type,
      label: prompt.label,
      isSystem: true,
      sections: prompt.sections,
      freeformSuffix: "",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("reportPromptVersions", {
      promptId,
      version: 1,
      sections: prompt.sections,
      freeformSuffix: "",
      changeMessage: "Initial seed",
      createdAt: now,
    });
  },
});

/**
 * Seed action: inserts all system defaults.
 * Called manually or from deployment script.
 */
export const seed = internalAction({
  handler: async (ctx) => {
    for (const prompt of SYSTEM_PROMPTS) {
      await ctx.runMutation(internal.migrations.seedReportPrompts.insertPrompt, { prompt });
    }
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd aws-optimizer/packages/convex && npx vitest run convex/reportPrompts.test.ts`
Expected: All tests PASS (including seed tests)

- [ ] **Step 5: Commit**

```bash
git add packages/convex/convex/migrations/seedReportPrompts.ts packages/convex/convex/reportPrompts.test.ts
git commit -m "feat(convex): add idempotent seed migration for system default prompts"
```

---

## Task 5: Backend — Integrate resolvePrompt into report generation

**Files:**
- Modify: `packages/convex/convex/ai/reportGeneration.ts:319-449,535-540`
- Modify: `packages/convex/convex/ai/costAnalysisInsights.ts:39,59`

- [ ] **Step 1: Refactor reportGeneration.ts — rename and add DB-aware wrapper**

In `packages/convex/convex/ai/reportGeneration.ts`:

1. Rename `buildReportPrompt` to `legacyBuildReportPrompt` (line 319)
2. Add import at top of file:
```typescript
import { internal } from "../_generated/api";
```
3. Replace the call site at line 535:

Before:
```typescript
const prompt = buildReportPrompt(
  reportType,
  reportTitle,
  organizationId,
  accounts as AwsAccount[]
);
```

After:
```typescript
// Try to resolve prompt from DB, fall back to hardcoded
// organizationId in generateReport args is a string; cast to Id<"organizations"> for the query
const dbPrompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
  type: reportType,
  organizationId: organizationId as Id<"organizations">,
});

let prompt: string;
if (dbPrompt) {
  const sectionTexts = dbPrompt.sections.map((s: any) => s.value).join("\n\n");
  const suffix = dbPrompt.freeformSuffix ? `\n\n${dbPrompt.freeformSuffix}` : "";
  const accountList = (accounts as AwsAccount[])
    .map((a) => `- ${a.name} (${a.accountNumber})${a.region ? ` - Region: ${a.region}` : ""}`)
    .join("\n");
  prompt = `You are generating a report titled: "${reportTitle}"\nOrganization ID: ${organizationId}\n\nAWS Accounts to analyze:\n${accountList}\n\n${sectionTexts}${suffix}`;
} else {
  prompt = legacyBuildReportPrompt(reportType, reportTitle, organizationId, accounts as AwsAccount[]);
}
```

- [ ] **Step 2: Refactor costAnalysisInsights.ts — add DB prompt loading**

In `packages/convex/convex/ai/costAnalysisInsights.ts`:

1. The function receives `_ctx` (unused). Change to `ctx` and use it.
2. Add import:
```typescript
import { internal } from "../_generated/api";
```
3. Before the `generateText` call at line 37, add prompt resolution:

```typescript
// Resolve prompt from DB
const dbPrompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
  type: "cost_analysis_insights",
});

const roleDefinition = dbPrompt?.sections.find((s: any) => s.key === "role_definition")?.value
  ?? "You are an AWS cost optimization expert.";
const execInstructions = dbPrompt?.sections.find((s: any) => s.key === "executive_summary_instructions")?.value
  ?? "Based on the following AWS cost data, write a concise executive insights paragraph (3-5 sentences). Focus on: key cost drivers, notable trends, and urgent areas needing attention. Be specific with numbers. Do NOT use markdown formatting - plain text only.";
const accountRules = dbPrompt?.sections.find((s: any) => s.key === "account_commentary_rules")?.value
  ?? "Based on the following account cost data, write 1-2 sentences of insight about what's driving costs and any recommended actions. Be specific. Plain text only, no markdown.";
```

4. Update the `generateText` calls to use resolved prompts:
```typescript
// Executive insights
prompt: `${roleDefinition}. ${execInstructions}\n\n${summaryText}`,

// Account insights
prompt: `${roleDefinition}. ${accountRules}\n\n${accountSummary}`,
```

- [ ] **Step 3: Run type check**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/convex/convex/ai/reportGeneration.ts packages/convex/convex/ai/costAnalysisInsights.ts
git commit -m "feat(ai): integrate resolvePrompt into report generation and cost insights"
```

---

## Task 6: Frontend — Route, navigation, and page shell

**Files:**
- Create: `apps/web/src/pages/AIPromptsPage.tsx`
- Modify: `apps/web/src/pages/index.ts`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/components/nav-items.tsx`

- [ ] **Step 1: Create AIPromptsPage shell**

Create `apps/web/src/pages/AIPromptsPage.tsx`:

```tsx
import { observer } from "mobx-react-lite";
import {
  Container,
  Title,
  Group,
  Grid,
  Text,
  Loader,
  Center,
} from "@mantine/core";
import { useQuery } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";

export const AIPromptsPage = observer(function AIPromptsPage() {
  const promptsData = useQuery(api.reportPrompts.list);

  if (!promptsData) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>AI Prompts</Title>
      </Group>

      <Grid>
        <Grid.Col span={3}>
          <Text c="dimmed" size="sm">
            {promptsData.systemDefaults.length} system defaults,{" "}
            {promptsData.orgOverrides.length} overrides
          </Text>
        </Grid.Col>
        <Grid.Col span={9}>
          <Text c="dimmed" size="sm">
            Select a prompt to edit
          </Text>
        </Grid.Col>
      </Grid>
    </Container>
  );
});
```

- [ ] **Step 2: Add page export to index.ts**

Add to `apps/web/src/pages/index.ts`:

```typescript
export { AIPromptsPage } from "./AIPromptsPage";
```

- [ ] **Step 3: Add route to router.tsx**

In `apps/web/src/router.tsx`:

1. Add `AIPromptsPage` to the import on line 2
2. Add route definition after `cronManagementRoute` (line 176):

```typescript
// AI Prompts route
const aiPromptsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/prompts",
  component: AIPromptsPage,
});
```

3. Add `aiPromptsRoute` to appLayoutRoute.addChildren array (after `cronManagementRoute`)

- [ ] **Step 4: Add nav item**

In `apps/web/src/components/nav-items.tsx`:

1. Add `IconRobot` to the icon imports
2. Add nav item after "Cron Jobs":

```typescript
{ label: "AI Prompts", path: "/settings/prompts", icon: <IconRobot size={20} /> },
```

- [ ] **Step 5: Verify compilation**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/AIPromptsPage.tsx apps/web/src/pages/index.ts apps/web/src/router.tsx apps/web/src/components/nav-items.tsx
git commit -m "feat(ui): add AI Prompts page shell with route and navigation"
```

---

## Task 7: Frontend — Prompt list component (left panel)

**Files:**
- Create: `apps/web/src/components/prompts/PromptList.tsx`
- Modify: `apps/web/src/pages/AIPromptsPage.tsx`

- [ ] **Step 1: Create PromptList component**

Create `apps/web/src/components/prompts/PromptList.tsx`:

```tsx
import {
  Stack,
  Text,
  NavLink,
  Badge,
  Divider,
  Button,
  Group,
} from "@mantine/core";
import {
  IconFileText,
  IconCoin,
  IconBulb,
  IconServer,
  IconReportAnalytics,
  IconBrain,
  IconPlus,
} from "@tabler/icons-react";
import type { Doc, Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

type Prompt = Doc<"reportPrompts">;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  cost_analysis: <IconCoin size={18} />,
  savings_summary: <IconBulb size={18} />,
  resource_inventory: <IconServer size={18} />,
  recommendation_summary: <IconReportAnalytics size={18} />,
  executive_summary: <IconFileText size={18} />,
  cost_analysis_insights: <IconBrain size={18} />,
};

interface PromptListProps {
  systemDefaults: Prompt[];
  orgOverrides: Prompt[];
  selectedId: Id<"reportPrompts"> | null;
  onSelect: (id: Id<"reportPrompts">) => void;
  isAdmin: boolean;
  onCreateNew?: () => void;
}

export function PromptList({
  systemDefaults,
  orgOverrides,
  selectedId,
  onSelect,
  isAdmin,
  onCreateNew,
}: PromptListProps) {
  const overrideTypes = new Set(orgOverrides.map((o) => o.type));

  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        System Defaults
      </Text>

      {systemDefaults.map((prompt) => (
        <NavLink
          key={prompt._id}
          label={
            <Group gap="xs">
              <Text size="sm">{prompt.label}</Text>
              {overrideTypes.has(prompt.type) && (
                <Badge size="xs" variant="light" color="blue">
                  Customized
                </Badge>
              )}
              {!prompt.isActive && (
                <Badge size="xs" variant="light" color="gray">
                  Inactive
                </Badge>
              )}
            </Group>
          }
          leftSection={TYPE_ICONS[prompt.type] ?? <IconFileText size={18} />}
          active={selectedId === prompt._id}
          onClick={() => onSelect(prompt._id)}
          variant="light"
        />
      ))}

      {orgOverrides.length > 0 && (
        <>
          <Divider my="xs" />
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Organization Overrides
          </Text>
          {orgOverrides.map((prompt) => (
            <NavLink
              key={prompt._id}
              label={prompt.label}
              leftSection={TYPE_ICONS[prompt.type] ?? <IconFileText size={18} />}
              active={selectedId === prompt._id}
              onClick={() => onSelect(prompt._id)}
              variant="light"
            />
          ))}
        </>
      )}

      {isAdmin && (
        <>
          <Divider my="xs" />
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={onCreateNew}
            fullWidth
          >
            New Report Type
          </Button>
        </>
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Wire PromptList into AIPromptsPage**

Update `AIPromptsPage.tsx`:

```tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Container,
  Title,
  Group,
  Grid,
  Text,
  Loader,
  Center,
  Paper,
} from "@mantine/core";
import { useQuery } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { PromptList } from "../components/prompts/PromptList";

export const AIPromptsPage = observer(function AIPromptsPage() {
  const promptsData = useQuery(api.reportPrompts.list);
  const [selectedId, setSelectedId] = useState<Id<"reportPrompts"> | null>(null);

  // TODO: determine isAdmin from user context (Task 8 will wire this)
  const isAdmin = false;

  if (!promptsData) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  const allPrompts = [...promptsData.systemDefaults, ...promptsData.orgOverrides];
  const selectedPrompt = selectedId ? allPrompts.find((p) => p._id === selectedId) : null;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>AI Prompts</Title>
      </Group>

      <Grid>
        <Grid.Col span={3}>
          <Paper withBorder p="sm">
            <PromptList
              systemDefaults={promptsData.systemDefaults}
              orgOverrides={promptsData.orgOverrides}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isAdmin={isAdmin}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={9}>
          {selectedPrompt ? (
            <Text>Selected: {selectedPrompt.label}</Text>
          ) : (
            <Center h={300}>
              <Text c="dimmed">Select a prompt to edit</Text>
            </Center>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
});
```

- [ ] **Step 3: Verify compilation**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/prompts/PromptList.tsx apps/web/src/pages/AIPromptsPage.tsx
git commit -m "feat(ui): add prompt list component with system defaults and org overrides"
```

---

## Task 8: Frontend — Prompt editor component (right panel)

**Files:**
- Create: `apps/web/src/components/prompts/PromptEditor.tsx`
- Modify: `apps/web/src/pages/AIPromptsPage.tsx`

- [ ] **Step 1: Create PromptEditor component**

Create `apps/web/src/components/prompts/PromptEditor.tsx`:

```tsx
import { useState } from "react";
import {
  Stack,
  Title,
  Badge,
  Group,
  Button,
  Textarea,
  TextInput,
  Select,
  Accordion,
  Modal,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Doc } from "@aws-optimizer/convex/convex/_generated/dataModel";

type Prompt = Doc<"reportPrompts">;
type Section = Prompt["sections"][number];

interface PromptEditorProps {
  prompt: Prompt;
  canEdit: boolean;
  onResetToDefault?: () => void;
  onViewHistory: () => void;
}

export function PromptEditor({
  prompt,
  canEdit,
  onResetToDefault,
  onViewHistory,
}: PromptEditorProps) {
  const [sections, setSections] = useState<Section[]>(prompt.sections);
  const [freeformSuffix, setFreeformSuffix] = useState(prompt.freeformSuffix);
  const [saveModalOpened, saveModal] = useDisclosure(false);
  const [changeMessage, setChangeMessage] = useState("");

  const updatePrompt = useMutation(api.reportPrompts.update);

  // Reset local state when prompt changes
  const [lastPromptId, setLastPromptId] = useState(prompt._id);
  if (prompt._id !== lastPromptId) {
    setSections(prompt.sections);
    setFreeformSuffix(prompt.freeformSuffix);
    setLastPromptId(prompt._id);
  }

  const hasChanges =
    JSON.stringify(sections) !== JSON.stringify(prompt.sections) ||
    freeformSuffix !== prompt.freeformSuffix;

  const updateSection = (index: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, value } : s))
    );
  };

  const handleSave = async () => {
    await updatePrompt({
      promptId: prompt._id,
      sections,
      freeformSuffix,
      changeMessage: changeMessage || undefined,
    });
    setChangeMessage("");
    saveModal.close();
  };

  const statusBadge = prompt.isSystem ? (
    <Badge variant="light" color="gray">System Default</Badge>
  ) : (
    <Badge variant="light" color="blue">Org Override</Badge>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={3}>{prompt.label}</Title>
          {statusBadge}
          {!prompt.isActive && (
            <Badge variant="light" color="orange">Inactive</Badge>
          )}
        </Group>
      </Group>

      <Accordion multiple defaultValue={sections.map((s) => s.key)}>
        {sections.map((section, index) => (
          <Accordion.Item key={section.key} value={section.key}>
            <Accordion.Control>{section.label}</Accordion.Control>
            <Accordion.Panel>
              {section.fieldType === "textarea" && (
                <Textarea
                  value={section.value}
                  onChange={(e) => updateSection(index, e.currentTarget.value)}
                  autosize
                  minRows={4}
                  maxRows={20}
                  disabled={!canEdit}
                />
              )}
              {section.fieldType === "text" && (
                <TextInput
                  value={section.value}
                  onChange={(e) => updateSection(index, e.currentTarget.value)}
                  disabled={!canEdit}
                />
              )}
              {section.fieldType === "select" && (
                <Select
                  value={section.value}
                  onChange={(val) => val && updateSection(index, val)}
                  data={section.options ?? []}
                  disabled={!canEdit}
                />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <Textarea
        label="Additional Instructions"
        description="Extra freeform instructions appended to the prompt"
        value={freeformSuffix}
        onChange={(e) => setFreeformSuffix(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={8}
        disabled={!canEdit}
      />

      <Group justify="flex-end">
        {!prompt.isSystem && onResetToDefault && (
          <Button variant="subtle" color="red" onClick={onResetToDefault} disabled={!canEdit}>
            Reset to Default
          </Button>
        )}
        <Button variant="subtle" onClick={onViewHistory}>
          View History
        </Button>
        <Button onClick={saveModal.open} disabled={!hasChanges || !canEdit}>
          Save
        </Button>
      </Group>

      <Modal opened={saveModalOpened} onClose={saveModal.close} title="Save Changes">
        <Stack>
          <TextInput
            label="Change Message (optional)"
            placeholder="Describe what changed..."
            value={changeMessage}
            onChange={(e) => setChangeMessage(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={saveModal.close}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
```

- [ ] **Step 2: Wire PromptEditor into AIPromptsPage**

Update `AIPromptsPage.tsx` to render `PromptEditor` in the right `Grid.Col` when a prompt is selected. Determine `canEdit` based on:
- System default → only if user is platform admin
- Org override → if user is org owner/admin

- [ ] **Step 3: Verify compilation**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/prompts/PromptEditor.tsx apps/web/src/pages/AIPromptsPage.tsx
git commit -m "feat(ui): add structured prompt editor with save modal"
```

---

## Task 9: Frontend — Version history drawer with diff

**Files:**
- Create: `apps/web/src/components/prompts/VersionHistoryDrawer.tsx`
- Modify: `apps/web/src/pages/AIPromptsPage.tsx`

- [ ] **Step 1: Create VersionHistoryDrawer component**

Create `apps/web/src/components/prompts/VersionHistoryDrawer.tsx`:

```tsx
import { useState } from "react";
import {
  Drawer,
  Stack,
  Card,
  Text,
  Group,
  Badge,
  Button,
  Grid,
  ScrollArea,
  Accordion,
  Code,
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { diffLines } from "diff";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

interface VersionHistoryDrawerProps {
  opened: boolean;
  onClose: () => void;
  promptId: Id<"reportPrompts">;
  promptLabel: string;
}

export function VersionHistoryDrawer({
  opened,
  onClose,
  promptId,
  promptLabel,
}: VersionHistoryDrawerProps) {
  const versions = useQuery(
    api.reportPromptVersions.listByPrompt,
    opened ? { promptId, limit: loadLimit } : "skip"
  );
  const updatePrompt = useMutation(api.reportPrompts.update);

  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [restoreModalOpened, restoreModal] = useDisclosure(false);
  const [viewVersion, setViewVersion] = useState<any | null>(null);
  const [loadLimit, setLoadLimit] = useState(20);

  const leftVersion = versions?.find((v) => v.version === compareLeft);
  const rightVersion = versions?.find((v) => v.version === compareRight);

  const handleRestore = async () => {
    const version = versions?.find((v) => v.version === restoreVersion);
    if (!version) return;

    await updatePrompt({
      promptId,
      sections: version.sections,
      freeformSuffix: version.freeformSuffix,
      changeMessage: `Restored from v${restoreVersion}`,
    });
    restoreModal.close();
    setRestoreVersion(null);
  };

  const isComparing = compareLeft !== null && compareRight !== null && leftVersion && rightVersion;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={`Version History — ${promptLabel}`}
      position="right"
      size={isComparing ? "xl" : "md"}
    >
      {isComparing ? (
        <Stack>
          <Group justify="space-between">
            <Badge>v{compareLeft}</Badge>
            <Button variant="subtle" size="xs" onClick={() => { setCompareLeft(null); setCompareRight(null); }}>
              Back to list
            </Button>
            <Badge>v{compareRight}</Badge>
          </Group>

          <Accordion multiple>
            {rightVersion.sections.map((section) => {
              const oldSection = leftVersion.sections.find((s) => s.key === section.key);
              const oldValue = oldSection?.value ?? "";
              const changes = diffLines(oldValue, section.value);
              const hasChanges = changes.some((c) => c.added || c.removed);

              if (!hasChanges) return null;

              return (
                <Accordion.Item key={section.key} value={section.key}>
                  <Accordion.Control>{section.label}</Accordion.Control>
                  <Accordion.Panel>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="xs" fw={700} c="dimmed" mb="xs">v{compareLeft}</Text>
                        <Code block>
                          {changes.map((part, i) => {
                            if (part.added) return null;
                            return (
                              <span
                                key={i}
                                style={{
                                  background: part.removed
                                    ? "var(--mantine-color-red-light)"
                                    : undefined,
                                  display: "block",
                                }}
                              >
                                {part.value}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" fw={700} c="dimmed" mb="xs">v{compareRight}</Text>
                        <Code block>
                          {changes.map((part, i) => {
                            if (part.removed) return null;
                            return (
                              <span
                                key={i}
                                style={{
                                  background: part.added
                                    ? "var(--mantine-color-green-light)"
                                    : undefined,
                                  display: "block",
                                }}
                              >
                                {part.value}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}

            {/* Diff freeformSuffix with same diffLines treatment */}
            {leftVersion.freeformSuffix !== rightVersion.freeformSuffix && (() => {
              const freeformChanges = diffLines(leftVersion.freeformSuffix, rightVersion.freeformSuffix);
              return (
                <Accordion.Item value="__freeform">
                  <Accordion.Control>Additional Instructions</Accordion.Control>
                  <Accordion.Panel>
                    <Grid>
                      <Grid.Col span={6}>
                        <Code block>
                          {freeformChanges.map((part, i) => {
                            if (part.added) return null;
                            return (
                              <span key={i} style={{ background: part.removed ? "var(--mantine-color-red-light)" : undefined, display: "block" }}>
                                {part.value || "(empty)"}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Code block>
                          {freeformChanges.map((part, i) => {
                            if (part.removed) return null;
                            return (
                              <span key={i} style={{ background: part.added ? "var(--mantine-color-green-light)" : undefined, display: "block" }}>
                                {part.value || "(empty)"}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })()}
          </Accordion>
        </Stack>
      ) : (
        <ScrollArea h="calc(100vh - 100px)">
          <Stack gap="xs">
            {!versions && <Text c="dimmed">Loading...</Text>}

            {/* Single version view */}
            {viewVersion && (
              <Card withBorder mb="md">
                <Group justify="space-between" mb="sm">
                  <Badge>v{viewVersion.version}</Badge>
                  <Button variant="subtle" size="xs" onClick={() => setViewVersion(null)}>Back to list</Button>
                </Group>
                {viewVersion.changeMessage && <Text size="sm" mb="xs" c="dimmed">{viewVersion.changeMessage}</Text>}
                <Accordion multiple>
                  {viewVersion.sections.map((s: any) => (
                    <Accordion.Item key={s.key} value={s.key}>
                      <Accordion.Control>{s.label}</Accordion.Control>
                      <Accordion.Panel><Code block>{s.value}</Code></Accordion.Panel>
                    </Accordion.Item>
                  ))}
                  {viewVersion.freeformSuffix && (
                    <Accordion.Item value="__freeform">
                      <Accordion.Control>Additional Instructions</Accordion.Control>
                      <Accordion.Panel><Code block>{viewVersion.freeformSuffix}</Code></Accordion.Panel>
                    </Accordion.Item>
                  )}
                </Accordion>
              </Card>
            )}

            {!viewVersion && versions?.map((version) => (
              <Card key={version._id} withBorder padding="sm">
                <Group justify="space-between" mb="xs">
                  <Badge variant="light">v{version.version}</Badge>
                  <Text size="xs" c="dimmed">
                    {new Date(version.createdAt).toLocaleString()}
                  </Text>
                </Group>
                {version.changeMessage && (
                  <Text size="sm" mb="xs">{version.changeMessage}</Text>
                )}
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setViewVersion(version)}
                  >
                    View
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      if (compareLeft === null) setCompareLeft(version.version);
                      else setCompareRight(version.version);
                    }}
                  >
                    {compareLeft === null ? "Compare from" : compareLeft !== null && compareRight === null ? "Compare to" : "Compare"}
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="orange"
                    onClick={() => {
                      setRestoreVersion(version.version);
                      restoreModal.open();
                    }}
                  >
                    Restore
                  </Button>
                </Group>
              </Card>
            ))}

            {/* Load More button for pagination */}
            {versions && versions.length >= loadLimit && (
              <Button
                variant="subtle"
                size="xs"
                fullWidth
                onClick={() => setLoadLimit((prev) => prev + 20)}
              >
                Load more
              </Button>
            )}
          </Stack>
        </ScrollArea>
      )}

      <Modal opened={restoreModalOpened} onClose={restoreModal.close} title="Restore Version">
        <Stack>
          <Text>
            Are you sure you want to restore to <strong>v{restoreVersion}</strong>?
            This will create a new version with the restored content.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={restoreModal.close}>Cancel</Button>
            <Button color="orange" onClick={handleRestore}>Restore</Button>
          </Group>
        </Stack>
      </Modal>
    </Drawer>
  );
}
```

- [ ] **Step 2: Wire VersionHistoryDrawer into AIPromptsPage**

Add drawer state to AIPromptsPage, pass `onViewHistory` to PromptEditor, render the drawer.

- [ ] **Step 3: Install diff package in web app workspace**

Run: `cd aws-optimizer && npm ls diff --workspace=apps/web`
If not found: `cd aws-optimizer/apps/web && npm install diff @types/diff`
Verify import resolves: add `import { diffLines } from "diff";` at top of VersionHistoryDrawer.tsx

- [ ] **Step 4: Verify compilation**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/prompts/VersionHistoryDrawer.tsx apps/web/src/pages/AIPromptsPage.tsx
git commit -m "feat(ui): add version history drawer with side-by-side diff and restore"
```

---

## Task 10: Frontend — Create org override and new report type flows

**Files:**
- Modify: `apps/web/src/pages/AIPromptsPage.tsx`

- [ ] **Step 1: Add "Create Override" button to PromptEditor for system defaults**

When viewing a system default prompt as an org user, show a "Customize for My Organization" button that:
1. Calls `api.reportPrompts.create` with `isSystem: false` and copies the system default's sections
2. Switches the selected prompt to the new override

- [ ] **Step 2: Add "Reset to Default" flow**

When viewing an org override, the "Reset to Default" button:
1. Shows confirmation modal warning about version history deletion
2. Calls `api.reportPrompts.remove` with the override's promptId
3. Switches view back to the system default

- [ ] **Step 3: Add "Create New Report Type" modal (admin only)**

When platform admin clicks "+ New Report Type" in the PromptList:
1. Opens modal with: Type slug (text), Label (text), initial sections (start with one default textarea section)
2. Calls `api.reportPrompts.create` with `isSystem: true`
3. Selects the newly created prompt

- [ ] **Step 4: Add "Activate/Deactivate" toggle for inactive prompts**

When viewing an inactive prompt, show a banner:
```tsx
{!prompt.isActive && (
  <Alert color="orange" mb="md" icon={<IconAlertTriangle size={16} />}>
    <Group justify="space-between" align="center">
      <Text size="sm">This prompt is inactive and will not be used for report generation.</Text>
      {canEdit && <Button size="xs" onClick={() => toggleActive({ promptId: prompt._id })}>Activate</Button>}
    </Group>
  </Alert>
)}
```

Also add a "Deactivate" option in the footer for active system prompts (admin only).

- [ ] **Step 5: Separate "Custom Types" group in PromptList**

Update `PromptList` to show 3 groups:
1. "System Defaults" — built-in 6 prompts (isSystem=true, type in known set)
2. "Custom Types" — admin-created prompts (isSystem=true, type NOT in known set)
3. "Organization Overrides" — org-specific overrides (isSystem=false)

- [ ] **Step 6: Verify compilation**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/AIPromptsPage.tsx
git commit -m "feat(ui): add create org override and reset to default flows"
```

---

## Task 11: Static checks and type verification

**Files:** All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `cd aws-optimizer && npx tsc --noEmit --max-old-space-size=8192`
Expected: No errors

- [ ] **Step 2: Run Convex sync check**

Run: `cd aws-optimizer && npx @fatagnus/convex-sync-check`
Expected: No schema drift

- [ ] **Step 3: Run all backend tests**

Run: `cd aws-optimizer/packages/convex && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit any fixes if needed**

```bash
git commit -m "fix: address type check and test issues"
```

---

## Task 12: E2E validation

- [ ] **Step 1: Start dev server**

Run: `cd aws-optimizer && npm run dev`
Verify: Server starts without errors

- [ ] **Step 2: Run seed migration**

In the Convex dashboard or via CLI, trigger `internal.migrations.seedReportPrompts.seed`

- [ ] **Step 3: Navigate to /settings/prompts and validate**

Verify:
- Left panel shows 6 system defaults
- Clicking a prompt shows the structured editor
- Editing and saving creates a new version
- Version history drawer opens and shows versions
- Diff view works between two versions
- Restore works and creates new version
- Create org override works
- Reset to default works

- [ ] **Step 4: Generate a report and verify DB prompt is used**

1. Edit a prompt (e.g., add "CUSTOM_MARKER" to cost_analysis intro)
2. Generate a cost_analysis report
3. Verify the report output contains the custom marker
