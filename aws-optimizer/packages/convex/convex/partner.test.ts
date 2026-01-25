/**
 * Partner Management Tests
 *
 * Tests for US-039: Implement partner - client organization creation
 * Following TDD: tests written BEFORE implementation.
 *
 * Acceptance Criteria:
 * 1. Add 'Create Client Org' button to partner dashboard
 * 2. Collect client organization name and primary contact email
 * 3. Create organization with partner as admin
 * 4. Send invite email to client primary contact
 * 5. Client becomes owner after accepting invite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestConvex } from "../test.setup";
import { api } from "./_generated/api";
import {
  createMockUser,
  createMockOrganization,
  createMockOrgMember,
  createMockAwsAccount,
  createMockRecommendation,
  createMockCostSnapshot,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Partner Client Organization Creation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TEST_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createClientOrganization mutation", () => {
    it("should create a client organization with partner as admin", async () => {
      const t = createTestConvex();

      // Create a partner user
      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      expect(result).toBeDefined();
      expect(result.organizationId).toBeDefined();
      expect(result.invitationId).toBeDefined();
    });

    it("should set organization name correctly", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Acme Industries",
        clientEmail: "client@acme.com",
      });

      // Verify the organization was created with correct name
      const org = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.organizationId);
      });

      expect(org).toBeDefined();
      expect(org?.name).toBe("Acme Industries");
    });

    it("should add partner as admin to the organization", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      // Verify partner is added as admin
      const membership = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_org_user", (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) =>
            q.eq("organizationId", result.organizationId).eq("userId", partner._id)
          )
          .first();
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe("admin");
    });

    it("should create an invitation for the client email", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      // Verify invitation was created
      const invitation = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.invitationId);
      });

      expect(invitation).toBeDefined();
      expect(invitation?.email).toBe("client@example.com");
      expect(invitation?.organizationId).toBe(result.organizationId);
      expect(invitation?.role).toBe("owner");
      expect(invitation?.status).toBe("pending");
    });

    it("should generate a unique slug for the organization", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const org = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.organizationId);
      });

      expect(org?.slug).toBeDefined();
      expect(org?.slug).toMatch(/^client-corp/);
    });

    it("should set organization plan to free by default", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const org = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.organizationId);
      });

      expect(org?.plan).toBe("free");
    });

    it("should reject creating org with invalid partner id", async () => {
      const t = createTestConvex();

      // Create a valid user just to get a valid ID format, then delete it
      const tempUser = await createMockUser(t);
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.delete(tempUser._id);
      });

      await expect(
        t.mutation(api.partner.createClientOrganization, {
          partnerId: tempUser._id,
          organizationName: "Client Corp",
          clientEmail: "client@example.com",
        })
      ).rejects.toThrow();
    });

    it("should reject creating org with empty organization name", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      await expect(
        t.mutation(api.partner.createClientOrganization, {
          partnerId: partner._id,
          organizationName: "",
          clientEmail: "client@example.com",
        })
      ).rejects.toThrow();
    });

    it("should reject creating org with empty client email", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      await expect(
        t.mutation(api.partner.createClientOrganization, {
          partnerId: partner._id,
          organizationName: "Client Corp",
          clientEmail: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("listClientOrganizations query", () => {
    it("should list organizations where user is admin (partner-created)", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      // Create a client organization
      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 1",
        clientEmail: "client1@example.com",
      });

      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 2",
        clientEmail: "client2@example.com",
      });

      const result = await t.query(api.partner.listClientOrganizations, {
        partnerId: partner._id,
      });

      expect(result).toHaveLength(2);
      expect(result.map((o: { name: string }) => o.name)).toContain("Client Corp 1");
      expect(result.map((o: { name: string }) => o.name)).toContain("Client Corp 2");
    });

    it("should return empty array if partner has no client organizations", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.query(api.partner.listClientOrganizations, {
        partnerId: partner._id,
      });

      expect(result).toHaveLength(0);
    });

    it("should include summary stats for each organization", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const result = await t.query(api.partner.listClientOrganizations, {
        partnerId: partner._id,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("totalCost");
      expect(result[0]).toHaveProperty("accountCount");
      expect(result[0]).toHaveProperty("alertCount");
    });
  });

  describe("acceptInvitation mutation", () => {
    it("should make client owner when accepting invitation", async () => {
      const t = createTestConvex();

      // Create partner and client org
      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      // Create the client user
      const client = await createMockUser(t, {
        email: "client@example.com",
        name: "Client User",
      });

      // Accept the invitation
      await t.mutation(api.partner.acceptInvitation, {
        invitationId: result.invitationId,
        userId: client._id,
      });

      // Verify client is now owner
      const membership = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("orgMembers")
          .withIndex("by_org_user", (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) =>
            q.eq("organizationId", result.organizationId).eq("userId", client._id)
          )
          .first();
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe("owner");
    });

    it("should mark invitation as accepted", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const client = await createMockUser(t, {
        email: "client@example.com",
        name: "Client User",
      });

      await t.mutation(api.partner.acceptInvitation, {
        invitationId: result.invitationId,
        userId: client._id,
      });

      // Verify invitation status
      const invitation = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.invitationId);
      });

      expect(invitation?.status).toBe("accepted");
    });

    it("should reject if invitation already accepted", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const client = await createMockUser(t, {
        email: "client@example.com",
        name: "Client User",
      });

      // Accept once
      await t.mutation(api.partner.acceptInvitation, {
        invitationId: result.invitationId,
        userId: client._id,
      });

      // Try to accept again
      await expect(
        t.mutation(api.partner.acceptInvitation, {
          invitationId: result.invitationId,
          userId: client._id,
        })
      ).rejects.toThrow();
    });

    it("should reject if user email does not match invitation email", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      // Different user trying to accept
      const wrongUser = await createMockUser(t, {
        email: "wrong@example.com",
        name: "Wrong User",
      });

      await expect(
        t.mutation(api.partner.acceptInvitation, {
          invitationId: result.invitationId,
          userId: wrongUser._id,
        })
      ).rejects.toThrow();
    });
  });
});

/**
 * US-040: Partner - Aggregate Reporting Tests
 *
 * Acceptance Criteria:
 * 1. Add aggregate view to partner dashboard
 * 2. Show total managed spend across all clients
 * 3. Display total savings recommendations
 * 4. Allow generating cross-client reports
 * 5. Maintain client data isolation in reports
 */
describe("Partner Aggregate Reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TEST_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getAggregateStats query", () => {
    it("should return aggregate stats for all client organizations", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      // Create two client organizations
      const result1 = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 1",
        clientEmail: "client1@example.com",
      });

      const result2 = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 2",
        clientEmail: "client2@example.com",
      });

      // Add AWS accounts and recommendations
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: result1.organizationId });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: result2.organizationId });

      await createMockRecommendation(t, {
        awsAccountId: awsAccount1._id,
        estimatedSavings: 100,
        status: "open",
      });

      await createMockRecommendation(t, {
        awsAccountId: awsAccount2._id,
        estimatedSavings: 200,
        status: "open",
      });

      const stats = await t.query(api.partner.getAggregateStats, {
        partnerId: partner._id,
      });

      expect(stats).toBeDefined();
      expect(stats.totalClients).toBe(2);
      expect(stats.totalAccounts).toBe(2);
      expect(stats.totalSavings).toBe(300); // 100 + 200
      expect(stats.totalRecommendations).toBe(2);
    });

    it("should include total cost across all clients", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const awsAccount = await createMockAwsAccount(t, { organizationId: result.organizationId });

      // Add cost snapshots
      const today = new Date().toISOString().split("T")[0];
      await createMockCostSnapshot(t, {
        awsAccountId: awsAccount._id,
        date: today,
        totalCost: 500,
      });

      const stats = await t.query(api.partner.getAggregateStats, {
        partnerId: partner._id,
      });

      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
    });

    it("should return zero values when no client organizations exist", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const stats = await t.query(api.partner.getAggregateStats, {
        partnerId: partner._id,
      });

      expect(stats.totalClients).toBe(0);
      expect(stats.totalAccounts).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.totalSavings).toBe(0);
      expect(stats.totalRecommendations).toBe(0);
    });
  });

  describe("listClientOrganizations with savings data", () => {
    it("should include totalSavings for each organization", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const awsAccount = await createMockAwsAccount(t, { organizationId: result.organizationId });

      await createMockRecommendation(t, {
        awsAccountId: awsAccount._id,
        estimatedSavings: 150,
        status: "open",
      });

      const orgs = await t.query(api.partner.listClientOrganizations, {
        partnerId: partner._id,
      });

      expect(orgs).toHaveLength(1);
      expect(orgs[0]).toHaveProperty("totalSavings");
      expect(orgs[0].totalSavings).toBe(150);
    });

    it("should include recommendationCount for each organization", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const awsAccount = await createMockAwsAccount(t, { organizationId: result.organizationId });

      await createMockRecommendation(t, {
        awsAccountId: awsAccount._id,
        estimatedSavings: 100,
        status: "open",
      });

      await createMockRecommendation(t, {
        awsAccountId: awsAccount._id,
        estimatedSavings: 50,
        status: "open",
      });

      const orgs = await t.query(api.partner.listClientOrganizations, {
        partnerId: partner._id,
      });

      expect(orgs).toHaveLength(1);
      expect(orgs[0]).toHaveProperty("recommendationCount");
      expect(orgs[0].recommendationCount).toBe(2);
    });
  });

  describe("generateAggregateReport mutation", () => {
    it("should create a report with aggregate data", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 1",
        clientEmail: "client1@example.com",
      });

      const result = await t.mutation(api.partner.generateAggregateReport, {
        partnerId: partner._id,
        reportType: "summary",
        includeAllClients: true,
        anonymize: false,
      });

      expect(result).toBeDefined();
      expect(result.reportId).toBeDefined();
    });

    it("should support anonymized reports", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp",
        clientEmail: "client@example.com",
      });

      const result = await t.mutation(api.partner.generateAggregateReport, {
        partnerId: partner._id,
        reportType: "summary",
        includeAllClients: true,
        anonymize: true,
      });

      expect(result.reportId).toBeDefined();
    });

    it("should support filtering to specific clients", async () => {
      const t = createTestConvex();

      const partner = await createMockUser(t, {
        email: "partner@example.com",
        name: "Partner User",
      });

      const result1 = await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 1",
        clientEmail: "client1@example.com",
      });

      await t.mutation(api.partner.createClientOrganization, {
        partnerId: partner._id,
        organizationName: "Client Corp 2",
        clientEmail: "client2@example.com",
      });

      const result = await t.mutation(api.partner.generateAggregateReport, {
        partnerId: partner._id,
        reportType: "detailed",
        includeAllClients: false,
        clientIds: [result1.organizationId],
        anonymize: false,
      });

      expect(result.reportId).toBeDefined();
    });
  });
});
