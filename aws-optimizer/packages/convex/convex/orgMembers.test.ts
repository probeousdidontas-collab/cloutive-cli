/**
 * Organization Member Management Tests
 *
 * Tests for US-009: Implement organization member management
 * Following TDD: tests written BEFORE implementation.
 *
 * Acceptance Criteria:
 * 1. Create orgMembers.ts with invite, updateRole, remove mutations
 * 2. Implement list query filtered by organizationId
 * 3. Only owners and admins can manage members
 * 4. Prevent removing the last owner
 * 5. Send invite email via Resend component
 *
 * Role hierarchy: owner > admin > member > viewer
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

describe("Organization Member Management", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TEST_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("list query", () => {
    it("should list all members of an organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, {
        name: "Test Org",
        slug: "test-org",
      });
      const owner = await createMockUser(t, { name: "Owner" });
      const admin = await createMockUser(t, { name: "Admin" });
      const member = await createMockUser(t, { name: "Member" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      const result = await t.query(api.orgMembers.list, {
        organizationId: org._id,
        userId: owner._id,
      });

      expect(result).toHaveLength(3);
      expect(result.map((m: { role: string }) => m.role)).toContain("owner");
      expect(result.map((m: { role: string }) => m.role)).toContain("admin");
      expect(result.map((m: { role: string }) => m.role)).toContain("member");
    });

    it("should include user details in the response", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t, {
        name: "John Owner",
        email: "john@example.com",
      });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      const result = await t.query(api.orgMembers.list, {
        organizationId: org._id,
        userId: owner._id,
      });

      expect(result).toHaveLength(1);
      expect(result[0].user?.name).toBe("John Owner");
      expect(result[0].user?.email).toBe("john@example.com");
    });

    it("should reject access from non-members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const nonMember = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.query(api.orgMembers.list, {
          organizationId: org._id,
          userId: nonMember._id,
        })
      ).rejects.toThrow();
    });

    it("should allow viewers to list members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const viewer = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      const result = await t.query(api.orgMembers.list, {
        organizationId: org._id,
        userId: viewer._id,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("invite mutation", () => {
    it("should allow owners to invite new members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "newuser@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      const result = await t.mutation(api.orgMembers.invite, {
        organizationId: org._id,
        userId: owner._id,
        inviteeEmail: "newuser@example.com",
        role: "member",
      });

      expect(result.membershipId).toBeDefined();

      // Verify member was added
      const members = await t.query(api.orgMembers.list, {
        organizationId: org._id,
        userId: owner._id,
      });
      expect(members).toHaveLength(2);
    });

    it("should allow admins to invite new members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "invited@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });

      const result = await t.mutation(api.orgMembers.invite, {
        organizationId: org._id,
        userId: admin._id,
        inviteeEmail: "invited@example.com",
        role: "member",
      });

      expect(result.membershipId).toBeDefined();
    });

    it("should reject invites from members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const regularMember = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "new@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: regularMember._id,
        role: "member",
      });

      await expect(
        t.mutation(api.orgMembers.invite, {
          organizationId: org._id,
          userId: regularMember._id,
          inviteeEmail: "new@example.com",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("should reject invites from viewers", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const viewer = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "new@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.orgMembers.invite, {
          organizationId: org._id,
          userId: viewer._id,
          inviteeEmail: "new@example.com",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("should prevent inviting already existing members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t, { email: "owner@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.orgMembers.invite, {
          organizationId: org._id,
          userId: owner._id,
          inviteeEmail: "owner@example.com",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("should prevent admins from inviting owners", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "newowner@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });

      await expect(
        t.mutation(api.orgMembers.invite, {
          organizationId: org._id,
          userId: admin._id,
          inviteeEmail: "newowner@example.com",
          role: "owner",
        })
      ).rejects.toThrow();
    });

    it("should allow owners to invite admins", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const newUser = await createMockUser(t, { email: "newadmin@example.com" });

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      const result = await t.mutation(api.orgMembers.invite, {
        organizationId: org._id,
        userId: owner._id,
        inviteeEmail: "newadmin@example.com",
        role: "admin",
      });

      expect(result.membershipId).toBeDefined();
    });
  });

  describe("updateRole mutation", () => {
    it("should allow owners to update member roles", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.orgMembers.updateRole, {
        organizationId: org._id,
        userId: owner._id,
        memberId: membership._id,
        newRole: "admin",
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(membership._id);
      });

      expect(updated?.role).toBe("admin");
    });

    it("should allow admins to update member/viewer roles", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);
      const viewer = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      await t.mutation(api.orgMembers.updateRole, {
        organizationId: org._id,
        userId: admin._id,
        memberId: membership._id,
        newRole: "member",
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(membership._id);
      });

      expect(updated?.role).toBe("member");
    });

    it("should prevent admins from promoting to owner", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await expect(
        t.mutation(api.orgMembers.updateRole, {
          organizationId: org._id,
          userId: admin._id,
          memberId: membership._id,
          newRole: "owner",
        })
      ).rejects.toThrow();
    });

    it("should prevent admins from demoting other admins", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin1 = await createMockUser(t);
      const admin2 = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin1._id,
        role: "admin",
      });
      const admin2Membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin2._id,
        role: "admin",
      });

      await expect(
        t.mutation(api.orgMembers.updateRole, {
          organizationId: org._id,
          userId: admin1._id,
          memberId: admin2Membership._id,
          newRole: "member",
        })
      ).rejects.toThrow();
    });

    it("should prevent members from updating roles", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);
      const viewer = await createMockUser(t);

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
      const viewerMembership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.orgMembers.updateRole, {
          organizationId: org._id,
          userId: member._id,
          memberId: viewerMembership._id,
          newRole: "member",
        })
      ).rejects.toThrow();
    });

    it("should allow owners to promote members to owner", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.orgMembers.updateRole, {
        organizationId: org._id,
        userId: owner._id,
        memberId: membership._id,
        newRole: "owner",
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(membership._id);
      });

      expect(updated?.role).toBe("owner");
    });
  });

  describe("remove mutation", () => {
    it("should allow owners to remove members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.orgMembers.remove, {
        organizationId: org._id,
        userId: owner._id,
        memberId: membership._id,
      });

      const deleted = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(membership._id);
      });

      expect(deleted).toBeNull();
    });

    it("should allow admins to remove members and viewers", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });
      const membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.orgMembers.remove, {
        organizationId: org._id,
        userId: admin._id,
        memberId: membership._id,
      });

      const deleted = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(membership._id);
      });

      expect(deleted).toBeNull();
    });

    it("should prevent admins from removing other admins", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin1 = await createMockUser(t);
      const admin2 = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin1._id,
        role: "admin",
      });
      const admin2Membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin2._id,
        role: "admin",
      });

      await expect(
        t.mutation(api.orgMembers.remove, {
          organizationId: org._id,
          userId: admin1._id,
          memberId: admin2Membership._id,
        })
      ).rejects.toThrow();
    });

    it("should prevent admins from removing owners", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const admin = await createMockUser(t);

      const ownerMembership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: admin._id,
        role: "admin",
      });

      await expect(
        t.mutation(api.orgMembers.remove, {
          organizationId: org._id,
          userId: admin._id,
          memberId: ownerMembership._id,
        })
      ).rejects.toThrow();
    });

    it("should prevent removing the last owner", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);

      const ownerMembership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.orgMembers.remove, {
          organizationId: org._id,
          userId: owner._id,
          memberId: ownerMembership._id,
        })
      ).rejects.toThrow(/last owner/i);
    });

    it("should allow removing an owner if there are other owners", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner1 = await createMockUser(t);
      const owner2 = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner1._id,
        role: "owner",
      });
      const owner2Membership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner2._id,
        role: "owner",
      });

      await t.mutation(api.orgMembers.remove, {
        organizationId: org._id,
        userId: owner1._id,
        memberId: owner2Membership._id,
      });

      const deleted = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(owner2Membership._id);
      });

      expect(deleted).toBeNull();
    });

    it("should prevent members from removing anyone", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);
      const viewer = await createMockUser(t);

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
      const viewerMembership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: viewer._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.orgMembers.remove, {
          organizationId: org._id,
          userId: member._id,
          memberId: viewerMembership._id,
        })
      ).rejects.toThrow();
    });

    it("should allow members to remove themselves", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const owner = await createMockUser(t);
      const member = await createMockUser(t);

      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });
      const memberMembership = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: member._id,
        role: "member",
      });

      await t.mutation(api.orgMembers.remove, {
        organizationId: org._id,
        userId: member._id,
        memberId: memberMembership._id,
      });

      const deleted = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(memberMembership._id);
      });

      expect(deleted).toBeNull();
    });
  });
});
