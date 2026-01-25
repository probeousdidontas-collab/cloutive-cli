/**
 * Cron Jobs Tests
 *
 * Tests for US-036: Implement cron jobs for scheduled analysis
 *
 * Tests cover:
 * - Daily cost collection job scheduling
 * - Filtering accounts with active subscriptions
 * - Workpool job prioritization
 * - Graceful failure handling with ActionRetrier
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
  createMockAwsAccount,
  createMockSubscription,
  createMockAwsCredentials,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Cron Jobs - Daily Cost Collection", () => {
  describe("getAccountsForCollection query", () => {
    it("should return AWS accounts with active subscriptions", async () => {
      const t = createTestConvex();

      // Create org with active subscription
      const org1 = await createMockOrganization(t, { name: "Active Org", plan: "professional" });
      await createMockSubscription(t, {
        organizationId: org1._id,
        status: "active",
      });
      const account1 = await createMockAwsAccount(t, {
        organizationId: org1._id,
        name: "Production",
        status: "active",
      });
      await createMockAwsCredentials(t, {
        awsAccountId: account1._id,
        encryptedAccessKeyId: "encrypted-AKIAIOSFODNN7EXAMPLE",
        encryptedSecretAccessKey: "encrypted-secret",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(1);
      expect(result[0].awsAccountId).toBe(account1._id);
      expect(result[0].organizationId).toBe(org1._id);
    });

    it("should include free tier organizations (no subscription required)", async () => {
      const t = createTestConvex();

      // Create free tier org (no subscription)
      const freeOrg = await createMockOrganization(t, { name: "Free Org", plan: "free" });
      const freeAccount = await createMockAwsAccount(t, {
        organizationId: freeOrg._id,
        name: "Free Account",
        status: "active",
      });
      await createMockAwsCredentials(t, {
        awsAccountId: freeAccount._id,
        encryptedAccessKeyId: "encrypted-AKIAIOSFODNN7EXAMPLE",
        encryptedSecretAccessKey: "encrypted-secret",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(1);
      expect(result[0].awsAccountId).toBe(freeAccount._id);
    });

    it("should exclude accounts from organizations with canceled subscriptions", async () => {
      const t = createTestConvex();

      // Create org with canceled subscription
      const canceledOrg = await createMockOrganization(t, { name: "Canceled Org", plan: "professional" });
      await createMockSubscription(t, {
        organizationId: canceledOrg._id,
        status: "canceled",
      });
      await createMockAwsAccount(t, {
        organizationId: canceledOrg._id,
        name: "Canceled Account",
        status: "active",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(0);
    });

    it("should exclude inactive AWS accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });
      await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Inactive Account",
        status: "inactive",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(0);
    });

    it("should exclude AWS accounts in error state", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });
      await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Error Account",
        status: "error",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(0);
    });

    it("should return multiple accounts from same organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Multi-Account Org", plan: "enterprise" });
      await createMockSubscription(t, {
        organizationId: org._id,
        status: "active",
      });
      const account1 = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Production",
        status: "active",
      });
      const account2 = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Staging",
        status: "active",
      });
      await createMockAwsCredentials(t, {
        awsAccountId: account1._id,
        encryptedAccessKeyId: "encrypted-key1",
        encryptedSecretAccessKey: "encrypted-secret1",
      });
      await createMockAwsCredentials(t, {
        awsAccountId: account2._id,
        encryptedAccessKeyId: "encrypted-key2",
        encryptedSecretAccessKey: "encrypted-secret2",
      });

      const result = await t.query("crons:getAccountsForCollection", {});

      expect(result.length).toBe(2);
    });
  });

  describe("scheduleCostCollection mutation", () => {
    it("should create analysis run record for each account", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Test Account",
        status: "active",
      });

      const result = await t.mutation("crons:scheduleCostCollection", {
        awsAccountId: account._id,
        organizationId: org._id,
      });

      expect(result.analysisRunId).toBeDefined();
      expect(result.scheduled).toBe(true);

      // Verify analysis run was created
      const analysisRun = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.analysisRunId);
      });

      expect(analysisRun).toBeDefined();
      expect(analysisRun.organizationId).toBe(org._id);
      expect(analysisRun.type).toBe("cost_snapshot");
      expect(analysisRun.status).toBe("pending");
    });

    it("should skip if analysis already running for account today", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Test Account",
        status: "active",
      });

      // Create existing running analysis for today
      await t.run(async (ctx: AnyCtx) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await ctx.db.insert("analysisRuns", {
          organizationId: org._id,
          awsAccountId: account._id,
          type: "cost_snapshot",
          status: "running",
          startedAt: today.getTime(),
          createdAt: today.getTime(),
          updatedAt: today.getTime(),
        });
      });

      const result = await t.mutation("crons:scheduleCostCollection", {
        awsAccountId: account._id,
        organizationId: org._id,
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toContain("already");
    });
  });

  describe("updateAnalysisRunStatus mutation", () => {
    it("should update analysis run status to completed", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });

      // Create an analysis run
      const analysisRunId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("analysisRuns", {
          organizationId: org._id,
          type: "cost_snapshot",
          status: "running",
          startedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation("crons:updateAnalysisRunStatus", {
        analysisRunId,
        status: "completed",
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(analysisRunId);
      });

      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeDefined();
    });

    it("should update analysis run status to failed", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "free" });

      const analysisRunId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("analysisRuns", {
          organizationId: org._id,
          type: "cost_snapshot",
          status: "running",
          startedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation("crons:updateAnalysisRunStatus", {
        analysisRunId,
        status: "failed",
      });

      const updated = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(analysisRunId);
      });

      expect(updated.status).toBe("failed");
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe("recordUsageForAnalysis mutation", () => {
    it("should record usage for billing purposes", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "professional" });

      await t.mutation("crons:recordUsageForAnalysis", {
        organizationId: org._id,
      });

      // Verify usage record was created
      const usageRecords = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("usageRecords")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org._id)
          )
          .collect();
      });

      expect(usageRecords.length).toBe(1);
      expect(usageRecords[0].type).toBe("analysis_run");
      expect(usageRecords[0].quantity).toBe(1);
    });
  });
});

describe("Cron Jobs - Job Prioritization", () => {
  it("should prioritize enterprise accounts over free accounts", async () => {
    const t = createTestConvex();

    // Create free tier account
    const freeOrg = await createMockOrganization(t, { name: "Free Org", plan: "free" });
    const freeAccount = await createMockAwsAccount(t, {
      organizationId: freeOrg._id,
      status: "active",
    });
    await createMockAwsCredentials(t, {
      awsAccountId: freeAccount._id,
      encryptedAccessKeyId: "encrypted-key",
      encryptedSecretAccessKey: "encrypted-secret",
    });

    // Create enterprise account
    const enterpriseOrg = await createMockOrganization(t, { name: "Enterprise Org", plan: "enterprise" });
    await createMockSubscription(t, {
      organizationId: enterpriseOrg._id,
      status: "active",
    });
    const enterpriseAccount = await createMockAwsAccount(t, {
      organizationId: enterpriseOrg._id,
      status: "active",
    });
    await createMockAwsCredentials(t, {
      awsAccountId: enterpriseAccount._id,
      encryptedAccessKeyId: "encrypted-key",
      encryptedSecretAccessKey: "encrypted-secret",
    });

    const result = await t.query("crons:getAccountsForCollection", {});

    expect(result.length).toBe(2);
    // Enterprise should be first (higher priority)
    expect(result[0].plan).toBe("enterprise");
    expect(result[1].plan).toBe("free");
  });
});
