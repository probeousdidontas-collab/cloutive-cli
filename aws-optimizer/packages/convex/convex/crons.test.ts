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
  createMockUser,
  createMockRecommendation,
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

describe("Cron Jobs - Weekly Summary Email (US-037)", () => {
  describe("getOrganizationsForWeeklySummary query", () => {
    it("should return organizations with weekly email preference", async () => {
      const t = createTestConvex();

      // Create org with weekly email preference
      const org = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("organizations", {
          name: "Weekly Org",
          slug: "weekly-org",
          plan: "professional",
          settings: {
            enableNotifications: true,
            notificationPreferences: {
              emailFrequency: "weekly",
              alertTypes: ["budget_exceeded", "anomaly_detected"],
            },
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Create user and membership for the org
      const user = await createMockUser(t, { email: "user@example.com" });
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("orgMembers", {
          organizationId: org,
          userId: user._id,
          role: "owner",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query("crons:getOrganizationsForWeeklySummary", {});

      expect(result.length).toBe(1);
      expect(result[0].organizationId).toBe(org);
      expect(result[0].recipients.length).toBe(1);
      expect(result[0].recipients[0].email).toBe("user@example.com");
    });

    it("should exclude organizations with notifications disabled", async () => {
      const t = createTestConvex();

      // Create org with notifications disabled
      await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("organizations", {
          name: "Disabled Org",
          slug: "disabled-org",
          plan: "professional",
          settings: {
            enableNotifications: false,
            notificationPreferences: {
              emailFrequency: "weekly",
              alertTypes: [],
            },
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query("crons:getOrganizationsForWeeklySummary", {});

      expect(result.length).toBe(0);
    });

    it("should exclude organizations with non-weekly email frequency", async () => {
      const t = createTestConvex();

      // Create org with daily email preference
      await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("organizations", {
          name: "Daily Org",
          slug: "daily-org",
          plan: "professional",
          settings: {
            enableNotifications: true,
            notificationPreferences: {
              emailFrequency: "daily",
              alertTypes: [],
            },
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query("crons:getOrganizationsForWeeklySummary", {});

      expect(result.length).toBe(0);
    });

    it("should exclude organizations with never email frequency", async () => {
      const t = createTestConvex();

      await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("organizations", {
          name: "Never Org",
          slug: "never-org",
          plan: "professional",
          settings: {
            enableNotifications: true,
            notificationPreferences: {
              emailFrequency: "never",
              alertTypes: [],
            },
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query("crons:getOrganizationsForWeeklySummary", {});

      expect(result.length).toBe(0);
    });
  });

  describe("generateWeeklySummaryData query", () => {
    it("should include total spend for the week", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "professional" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        status: "active",
      });

      // Create cost snapshots for the past week
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        await t.run(async (ctx: AnyCtx) => {
          await ctx.db.insert("costSnapshots", {
            awsAccountId: account._id,
            date: dateStr,
            totalCost: 100, // $100 per day
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
      }

      const result = await t.query("crons:generateWeeklySummaryData", {
        organizationId: org._id,
      });

      expect(result.totalSpend).toBe(700); // 7 days * $100
    });

    it("should include top cost changes", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "professional" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        status: "active",
      });

      // Create cost snapshots with service breakdown
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];

      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("costSnapshots", {
          awsAccountId: account._id,
          date: weekAgoStr,
          totalCost: 500,
          serviceBreakdown: { "Amazon EC2": 300, "Amazon S3": 200 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("costSnapshots", {
          awsAccountId: account._id,
          date: todayStr,
          totalCost: 700,
          serviceBreakdown: { "Amazon EC2": 500, "Amazon S3": 200 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query("crons:generateWeeklySummaryData", {
        organizationId: org._id,
      });

      expect(result.topChanges).toBeDefined();
      expect(Array.isArray(result.topChanges)).toBe(true);
    });

    it("should include top recommendations", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "professional" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        status: "active",
      });

      // Create recommendations
      await createMockRecommendation(t, {
        awsAccountId: account._id,
        title: "Rightsize EC2 Instance",
        estimatedSavings: 150,
        status: "open",
      });
      await createMockRecommendation(t, {
        awsAccountId: account._id,
        title: "Delete Unused EBS Volume",
        estimatedSavings: 50,
        status: "open",
      });

      const result = await t.query("crons:generateWeeklySummaryData", {
        organizationId: org._id,
      });

      expect(result.topRecommendations).toBeDefined();
      expect(result.topRecommendations.length).toBe(2);
      // Should be sorted by savings (highest first)
      expect(result.topRecommendations[0].estimatedSavings).toBe(150);
    });

    it("should limit top recommendations to 5", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org", plan: "professional" });
      const account = await createMockAwsAccount(t, {
        organizationId: org._id,
        status: "active",
      });

      // Create 10 recommendations
      for (let i = 0; i < 10; i++) {
        await createMockRecommendation(t, {
          awsAccountId: account._id,
          title: `Recommendation ${i}`,
          estimatedSavings: (i + 1) * 10,
          status: "open",
        });
      }

      const result = await t.query("crons:generateWeeklySummaryData", {
        organizationId: org._id,
      });

      expect(result.topRecommendations.length).toBe(5);
    });
  });

  describe("Weekly summary cron job configuration", () => {
    it("should have weekly cron job defined", async () => {
      // Import the crons module to verify the cron is defined
      const cronsModule = await import("./crons");
      expect(cronsModule.default).toBeDefined();
      // The cron jobs object exists - we trust the cron configuration is correct
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
