/**
 * Core Schema Tests
 *
 * Tests for the core database schema: organizations, orgMembers, and users.
 * Validates that the schema correctly supports multi-tenancy.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
  createMockUser,
  createMockOrgMember,
  createOrganizationWithOwner,
  type OrgMemberRole,
  type OrganizationPlan,
  type UserStatus,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Core Schema", () => {
  describe("Organizations Table", () => {
    it("should create an organization with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, {
        name: "Acme Corp",
        slug: "acme-corp",
        plan: "professional",
      });

      expect(org._id).toBeDefined();
      expect(org.name).toBe("Acme Corp");
      expect(org.slug).toBe("acme-corp");
      expect(org.plan).toBe("professional");
      expect(org.createdAt).toBeDefined();
      expect(org.updatedAt).toBeDefined();
    });

    it("should support all plan types", async () => {
      const t = createTestConvex();
      const plans: OrganizationPlan[] = ["free", "starter", "professional", "enterprise"];

      for (const plan of plans) {
        const org = await createMockOrganization(t, {
          name: `${plan} Org`,
          slug: `${plan}-org`,
          plan,
        });
        expect(org.plan).toBe(plan);
      }
    });

    it("should store custom settings", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, {
        name: "Settings Test Org",
        settings: {
          enableNotifications: true,
          maxUsers: 10,
          customDomain: "acme.example.com",
        },
      });

      expect(org.settings).toEqual({
        enableNotifications: true,
        maxUsers: 10,
        customDomain: "acme.example.com",
      });
    });

    it("should query organization by slug index", async () => {
      const t = createTestConvex();

      await createMockOrganization(t, {
        name: "Indexed Org",
        slug: "indexed-org",
      });

      const foundOrg = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q: { eq: (field: string, value: string) => unknown }) => q.eq("slug", "indexed-org"))
          .first();
      });

      expect(foundOrg).toBeDefined();
      expect(foundOrg?.name).toBe("Indexed Org");
    });
  });

  describe("Users Table", () => {
    it("should create a user with Better Auth compatible fields", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t, {
        email: "john@example.com",
        name: "John Doe",
        role: "user",
        status: "active",
        emailVerified: true,
      });

      expect(user._id).toBeDefined();
      expect(user.email).toBe("john@example.com");
      expect(user.name).toBe("John Doe");
      expect(user.role).toBe("user");
      expect(user.status).toBe("active");
      expect(user.emailVerified).toBe(true);
    });

    it("should support all user roles", async () => {
      const t = createTestConvex();

      const adminUser = await createMockUser(t, { role: "admin" });
      const regularUser = await createMockUser(t, { role: "user" });

      expect(adminUser.role).toBe("admin");
      expect(regularUser.role).toBe("user");
    });

    it("should support all user statuses", async () => {
      const t = createTestConvex();
      const statuses: UserStatus[] = ["active", "inactive", "pending"];

      for (const status of statuses) {
        const user = await createMockUser(t, { status });
        expect(user.status).toBe(status);
      }
    });

    it("should query user by email index", async () => {
      const t = createTestConvex();

      await createMockUser(t, {
        email: "indexed@example.com",
        name: "Indexed User",
      });

      const foundUser = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) => q.eq("email", "indexed@example.com"))
          .first();
      });

      expect(foundUser).toBeDefined();
      expect(foundUser?.name).toBe("Indexed User");
    });

    it("should query users by status index", async () => {
      const t = createTestConvex();

      await createMockUser(t, { status: "active" });
      await createMockUser(t, { status: "active" });
      await createMockUser(t, { status: "pending" });

      const activeUsers = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) => q.eq("status", "active"))
          .collect();
      });

      expect(activeUsers.length).toBe(2);
    });
  });

  describe("OrgMembers Table", () => {
    it("should create organization membership", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      const member = await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      expect(member._id).toBeDefined();
      expect(member.organizationId).toBe(org._id);
      expect(member.userId).toBe(user._id);
      expect(member.role).toBe("member");
    });

    it("should support all member roles", async () => {
      const t = createTestConvex();
      const roles: OrgMemberRole[] = ["owner", "admin", "member", "viewer"];

      const org = await createMockOrganization(t);

      for (const role of roles) {
        const user = await createMockUser(t);
        const member = await createMockOrgMember(t, {
          organizationId: org._id,
          userId: user._id,
          role,
        });
        expect(member.role).toBe(role);
      }
    });

    it("should query members by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      const user1 = await createMockUser(t);
      const user2 = await createMockUser(t);
      const user3 = await createMockUser(t);

      await createMockOrgMember(t, { organizationId: org1._id, userId: user1._id });
      await createMockOrgMember(t, { organizationId: org1._id, userId: user2._id });
      await createMockOrgMember(t, { organizationId: org2._id, userId: user3._id });

      const org1Members = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => q.eq("organizationId", org1._id))
          .collect();
      });

      expect(org1Members.length).toBe(2);
    });

    it("should query members by user index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-a" });
      const org2 = await createMockOrganization(t, { slug: "org-b" });
      const user = await createMockUser(t);

      await createMockOrgMember(t, { organizationId: org1._id, userId: user._id });
      await createMockOrgMember(t, { organizationId: org2._id, userId: user._id });

      const userMemberships = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_user", (q: { eq: (field: string, value: unknown) => unknown }) => q.eq("userId", user._id))
          .collect();
      });

      expect(userMemberships.length).toBe(2);
    });

    it("should query by organization and user combined index", async () => {
      const t = createTestConvex();

      const { organization, owner } = await createOrganizationWithOwner(t);

      const membership = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_org_user", (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) => 
            q.eq("organizationId", organization._id).eq("userId", owner._id)
          )
          .first();
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe("owner");
    });
  });

  describe("Multi-tenancy Support", () => {
    it("should support a user being a member of multiple organizations", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t, { name: "Multi-org User" });
      const org1 = await createMockOrganization(t, { name: "Org 1", slug: "org-1" });
      const org2 = await createMockOrganization(t, { name: "Org 2", slug: "org-2" });
      const org3 = await createMockOrganization(t, { name: "Org 3", slug: "org-3" });

      await createMockOrgMember(t, { organizationId: org1._id, userId: user._id, role: "owner" });
      await createMockOrgMember(t, { organizationId: org2._id, userId: user._id, role: "admin" });
      await createMockOrgMember(t, { organizationId: org3._id, userId: user._id, role: "viewer" });

      const memberships = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_user", (q: { eq: (field: string, value: unknown) => unknown }) => q.eq("userId", user._id))
          .collect();
      });

      expect(memberships.length).toBe(3);
    });

    it("should support an organization having multiple members", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Team Org" });

      const owner = await createMockUser(t, { name: "Owner" });
      const admin = await createMockUser(t, { name: "Admin" });
      const member1 = await createMockUser(t, { name: "Member 1" });
      const member2 = await createMockUser(t, { name: "Member 2" });
      const viewer = await createMockUser(t, { name: "Viewer" });

      await createMockOrgMember(t, { organizationId: org._id, userId: owner._id, role: "owner" });
      await createMockOrgMember(t, { organizationId: org._id, userId: admin._id, role: "admin" });
      await createMockOrgMember(t, { organizationId: org._id, userId: member1._id, role: "member" });
      await createMockOrgMember(t, { organizationId: org._id, userId: member2._id, role: "member" });
      await createMockOrgMember(t, { organizationId: org._id, userId: viewer._id, role: "viewer" });

      const members = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) => q.eq("organizationId", org._id))
          .collect();
      });

      expect(members.length).toBe(5);
    });
  });
});
