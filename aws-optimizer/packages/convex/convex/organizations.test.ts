/**
 * Organization CRUD Operations Tests
 *
 * Tests for US-008: Implement organization CRUD operations
 * Following TDD: tests written BEFORE implementation.
 *
 * Acceptance Criteria:
 * 1. Create organizations.ts with create, update, delete mutations
 * 2. Implement getById and list queries
 * 3. Auto-create orgMember with 'owner' role when organization is created
 * 4. Require authentication for all operations
 * 5. Add activity logging for organization changes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestConvex } from "../test.setup";
import { api } from "./_generated/api";
import {
  createMockUser,
  createMockOrganization,
  createMockOrgMember,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Organization CRUD Operations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TEST_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("create mutation", () => {
    it("should create an organization with valid data", async () => {
      const t = createTestConvex();

      // Create a user first (needed for owner)
      const user = await createMockUser(t, {
        email: "owner@example.com",
        name: "Test Owner",
        role: "admin",
      });

      const result = await t.mutation(api.organizations.create, {
        name: "Test Organization",
        slug: "test-org",
        plan: "free",
        userId: user._id,
      });

      expect(result).toBeDefined();
      expect(result.organizationId).toBeDefined();
      expect(result.membershipId).toBeDefined();
    });

    it("should auto-create orgMember with owner role when organization is created", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t, {
        email: "owner@example.com",
        name: "Test Owner",
      });

      const result = await t.mutation(api.organizations.create, {
        name: "Owner Test Org",
        slug: "owner-test-org",
        plan: "free",
        userId: user._id,
      });

      // Verify the membership was created with owner role
      const membership = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.membershipId);
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe("owner");
      expect(membership?.userId).toBe(user._id);
      expect(membership?.organizationId).toBe(result.organizationId);
    });

    it("should log activity when organization is created", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t, {
        email: "owner@example.com",
        name: "Test Owner",
      });

      const result = await t.mutation(api.organizations.create, {
        name: "Activity Log Test Org",
        slug: "activity-log-test-org",
        plan: "starter",
        userId: user._id,
      });

      // Verify activity log was created
      const logs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("activityLogs")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => 
            q.eq("organizationId", result.organizationId)
          )
          .collect();
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("create");
      expect(logs[0].entityType).toBe("organization");
      expect(logs[0].userId).toBe(user._id);
    });

    it("should reject duplicate slugs", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);

      // Create first organization
      await t.mutation(api.organizations.create, {
        name: "First Org",
        slug: "duplicate-slug",
        plan: "free",
        userId: user._id,
      });

      // Attempt to create second organization with same slug
      await expect(
        t.mutation(api.organizations.create, {
          name: "Second Org",
          slug: "duplicate-slug",
          plan: "free",
          userId: user._id,
        })
      ).rejects.toThrow();
    });

    it("should support all plan types", async () => {
      const t = createTestConvex();
      const plans = ["free", "starter", "professional", "enterprise"] as const;

      for (const plan of plans) {
        const user = await createMockUser(t);
        const result = await t.mutation(api.organizations.create, {
          name: `${plan} Org`,
          slug: `${plan}-org-${Date.now()}`,
          plan,
          userId: user._id,
        });

        const org = await t.run(async (ctx: AnyCtx) => {
          return await ctx.db.get(result.organizationId);
        });

        expect(org?.plan).toBe(plan);
      }
    });
  });

  describe("update mutation", () => {
    it("should update organization name", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Original Name",
        slug: "original-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await t.mutation(api.organizations.update, {
        id: org._id,
        name: "Updated Name",
        userId: user._id,
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(org._id);
      });

      expect(updated?.name).toBe("Updated Name");
    });

    it("should update organization plan", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Plan Test Org",
        slug: "plan-test-org",
        plan: "free",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await t.mutation(api.organizations.update, {
        id: org._id,
        plan: "professional",
        userId: user._id,
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(org._id);
      });

      expect(updated?.plan).toBe("professional");
    });

    it("should update organization settings", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Settings Test Org",
        slug: "settings-test-org",
        settings: {},
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await t.mutation(api.organizations.update, {
        id: org._id,
        settings: {
          enableNotifications: true,
          maxUsers: 50,
        },
        userId: user._id,
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(org._id);
      });

      expect(updated?.settings.enableNotifications).toBe(true);
      expect(updated?.settings.maxUsers).toBe(50);
    });

    it("should log activity when organization is updated", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Log Test Org",
        slug: "log-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await t.mutation(api.organizations.update, {
        id: org._id,
        name: "Updated Log Test Org",
        userId: user._id,
      });

      const logs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("activityLogs")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => 
            q.eq("organizationId", org._id)
          )
          .collect();
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("update");
      expect(logs[0].entityType).toBe("organization");
    });

    it("should reject updates from non-members", async () => {
      const t = createTestConvex();

      const owner = await createMockUser(t);
      const nonMember = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Access Test Org",
        slug: "access-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.organizations.update, {
          id: org._id,
          name: "Hacked Name",
          userId: nonMember._id,
        })
      ).rejects.toThrow();
    });

    it("should reject updates from viewers", async () => {
      const t = createTestConvex();

      const viewer = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Viewer Test Org",
        slug: "viewer-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.organizations.update, {
          id: org._id,
          name: "Should Not Update",
          userId: viewer._id,
        })
      ).rejects.toThrow();
    });
  });

  describe("delete mutation", () => {
    it("should delete an organization", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Delete Test Org",
        slug: "delete-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await t.mutation(api.organizations.remove, {
        id: org._id,
        userId: user._id,
      });

      const deleted = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(org._id);
      });

      expect(deleted).toBeNull();
    });

    it("should delete associated org members when organization is deleted", async () => {
      const t = createTestConvex();

      const owner = await createMockUser(t);
      const member = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Cascade Delete Org",
        slug: "cascade-delete-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.organizations.remove, {
        id: org._id,
        userId: owner._id,
      });

      const members = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => 
            q.eq("organizationId", org._id)
          )
          .collect();
      });

      expect(members.length).toBe(0);
    });

    it("should only allow owners to delete organizations", async () => {
      const t = createTestConvex();

      const admin = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Owner Only Delete Org",
        slug: "owner-only-delete-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin", // Admin, not owner
      });

      await expect(
        t.mutation(api.organizations.remove, {
          id: org._id,
          userId: admin._id,
        })
      ).rejects.toThrow();
    });

    it("should log activity when organization is deleted", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Delete Log Test Org",
        slug: "delete-log-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      // Store orgId before deletion for querying logs
      const orgId = org._id;

      await t.mutation(api.organizations.remove, {
        id: org._id,
        userId: user._id,
      });

      const logs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("activityLogs")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => 
            q.eq("organizationId", orgId)
          )
          .collect();
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("delete");
      expect(logs[0].entityType).toBe("organization");
    });
  });

  describe("getById query", () => {
    it("should return organization by ID", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "GetById Test Org",
        slug: "getbyid-test-org",
        plan: "professional",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      const result = await t.query(api.organizations.getById, {
        id: org._id,
        userId: user._id,
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("GetById Test Org");
      expect(result?.slug).toBe("getbyid-test-org");
      expect(result?.plan).toBe("professional");
    });

    it("should return null for non-existent organization", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      // Delete the org to make it non-existent
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.delete(org._id);
      });

      const result = await t.query(api.organizations.getById, {
        id: org._id,
        userId: user._id,
      });

      expect(result).toBeNull();
    });

    it("should reject access from non-members", async () => {
      const t = createTestConvex();

      const owner = await createMockUser(t);
      const nonMember = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Access Control Org",
        slug: "access-control-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.query(api.organizations.getById, {
          id: org._id,
          userId: nonMember._id,
        })
      ).rejects.toThrow();
    });
  });

  describe("list query", () => {
    it("should list organizations the user is a member of", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org1 = await createMockOrganization(t, {
        name: "Org 1",
        slug: "org-1",
      });
      const org2 = await createMockOrganization(t, {
        name: "Org 2",
        slug: "org-2",
      });
      const org3 = await createMockOrganization(t, {
        name: "Org 3 (Not Member)",
        slug: "org-3",
      });

      await createMockOrgMember(t, {
        organizationId: org1._id,
        userId: user._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org2._id,
        userId: user._id,
        role: "member",
      });
      // Note: user is NOT a member of org3

      const result = await t.query(api.organizations.list, {
        userId: user._id,
      });

      expect(result.length).toBe(2);
      expect(result.map((o: { name: string }) => o.name)).toContain("Org 1");
      expect(result.map((o: { name: string }) => o.name)).toContain("Org 2");
      expect(result.map((o: { name: string }) => o.name)).not.toContain("Org 3 (Not Member)");
    });

    it("should return empty array if user has no organizations", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);

      const result = await t.query(api.organizations.list, {
        userId: user._id,
      });

      expect(result).toEqual([]);
    });

    it("should include membership role in the response", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Role Test Org",
        slug: "role-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "admin",
      });

      const result = await t.query(api.organizations.list, {
        userId: user._id,
      });

      expect(result.length).toBe(1);
      expect(result[0].memberRole).toBe("admin");
    });
  });

  describe("getBySlug query", () => {
    it("should return organization by slug", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t, {
        name: "Slug Test Org",
        slug: "slug-test-org",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      const result = await t.query(api.organizations.getBySlug, {
        slug: "slug-test-org",
        userId: user._id,
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Slug Test Org");
    });

    it("should return null for non-existent slug", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);

      const result = await t.query(api.organizations.getBySlug, {
        slug: "non-existent-slug",
        userId: user._id,
      });

      expect(result).toBeNull();
    });
  });
});
