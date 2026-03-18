import { describe, it, expect } from "vitest";
import { createTestConvex, type TestCtx } from "../test.setup";
import type { Id } from "./_generated/dataModel";

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
  describe("resolvePrompt logic", () => {
    it("returns system default when no org override exists", async () => {
      const t = createTestConvex();
      const orgId = await seedTestOrg(t);
      await seedSystemPrompt(t, "cost_analysis");

      const result = await t.run(async (ctx: TestCtx) => {
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
    });
  });
});

describe("reportPromptVersions", () => {
  it("lists versions newest first", async () => {
    const t = createTestConvex();
    const now = Date.now();

    const promptId = await t.run(async (ctx: TestCtx) => {
      return await ctx.db.insert("reportPrompts", {
        type: "cost_analysis",
        label: "Cost Analysis",
        isSystem: true,
        sections: [
          { key: "intro", label: "Introduction", value: "Default intro", fieldType: "textarea" as const },
        ],
        freeformSuffix: "",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }) as Id<"reportPrompts">;

    await t.run(async (ctx: TestCtx) => {
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: [
          { key: "intro", label: "Introduction", value: "Version 1 intro", fieldType: "textarea" as const },
        ],
        freeformSuffix: "",
        createdAt: now - 1000,
      });
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 2,
        sections: [
          { key: "intro", label: "Introduction", value: "Version 2 intro", fieldType: "textarea" as const },
        ],
        freeformSuffix: "suffix",
        createdAt: now,
      });
    });

    const versions = await t.run(async (ctx: TestCtx) => {
      return await ctx.db
        .query("reportPromptVersions")
        .withIndex("by_prompt", (q: any) => q.eq("promptId", promptId))
        .order("desc")
        .take(20);
    });

    expect(versions).toHaveLength(2);
    // Newest (highest _creationTime) first
    expect(versions[0].version).toBe(2);
    expect(versions[1].version).toBe(1);
  });

  it("fetches specific version by prompt + version number", async () => {
    const t = createTestConvex();
    const now = Date.now();

    const promptId = await t.run(async (ctx: TestCtx) => {
      return await ctx.db.insert("reportPrompts", {
        type: "security",
        label: "Security",
        isSystem: true,
        sections: [
          { key: "body", label: "Body", value: "Default body", fieldType: "textarea" as const },
        ],
        freeformSuffix: "",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }) as Id<"reportPrompts">;

    await t.run(async (ctx: TestCtx) => {
      await ctx.db.insert("reportPromptVersions", {
        promptId,
        version: 1,
        sections: [
          { key: "body", label: "Body", value: "V1 body", fieldType: "textarea" as const },
        ],
        freeformSuffix: "",
        createdAt: now,
      });
    });

    const result = await t.run(async (ctx: TestCtx) => {
      return await ctx.db
        .query("reportPromptVersions")
        .withIndex("by_prompt_and_version", (q: any) =>
          q.eq("promptId", promptId).eq("version", 1)
        )
        .first();
    });

    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.sections[0].value).toBe("V1 body");
  });
});
