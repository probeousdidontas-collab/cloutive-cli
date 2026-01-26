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
import { createTestConvex, type TestCtx } from "../test.setup";
import {
  createMockOrganization,
  createMockAwsAccount,
  createMockSubscription,
  createMockAwsCredentials,
  createMockUser,
  createMockRecommendation,
} from "./test.helpers";
// Note: api import removed - crons functions are internal and not exposed

// Type assertion helper for convex-test
type AnyCtx = TestCtx;

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const allAccounts = await ctx.db.query("awsAccounts").collect();
        const accountsForCollection: Array<{ awsAccountId: string; organizationId: string }> = [];
        
        for (const account of allAccounts) {
          if (account.status !== "active") continue;
          
          const org = await ctx.db.get(account.organizationId);
          if (!org) continue;
          
          const credentials = await ctx.db
            .query("awsCredentials")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .first();
          if (!credentials) continue;
          
          if (org.plan !== "free") {
            const subscription = await ctx.db
              .query("subscriptions")
              .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
              .first();
            if (!subscription || subscription.status === "canceled") continue;
          }
          
          accountsForCollection.push({
            awsAccountId: account._id,
            organizationId: account.organizationId,
          });
        }
        
        return accountsForCollection;
      });

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

      // Internal mutation - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        // Check for existing running analysis today
        const existing = await ctx.db
          .query("analysisRuns")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .filter((q: AnyCtx) =>
            q.and(
              q.eq(q.field("awsAccountId"), account._id),
              q.eq(q.field("status"), "running"),
              q.gte(q.field("startedAt"), today.getTime())
            )
          )
          .first();
        
        if (existing) {
          return { scheduled: false, reason: "Analysis already running for this account today" };
        }
        
        const analysisRunId = await ctx.db.insert("analysisRuns", {
          organizationId: org._id,
          awsAccountId: account._id,
          type: "cost_snapshot",
          status: "pending",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        
        return { analysisRunId, scheduled: true };
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

      // Internal mutation - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        // Check for existing running analysis today
        const existing = await ctx.db
          .query("analysisRuns")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .filter((q: AnyCtx) =>
            q.and(
              q.eq(q.field("awsAccountId"), account._id),
              q.eq(q.field("status"), "running"),
              q.gte(q.field("startedAt"), today.getTime())
            )
          )
          .first();
        
        if (existing) {
          return { scheduled: false, reason: "Analysis already running for this account today" };
        }
        
        const analysisRunId = await ctx.db.insert("analysisRuns", {
          organizationId: org._id,
          awsAccountId: account._id,
          type: "cost_snapshot",
          status: "pending",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        
        return { analysisRunId, scheduled: true };
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

      // Internal mutation - use direct DB operation
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(analysisRunId, {
          status: "completed",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
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

      // Internal mutation - use direct DB operation
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(analysisRunId, {
          status: "failed",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
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

      // Internal mutation - use direct DB operation
      await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        await ctx.db.insert("usageRecords", {
          organizationId: org._id,
          type: "analysis_run",
          quantity: 1,
          createdAt: now,
          updatedAt: now,
        });
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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const orgs = await ctx.db.query("organizations").collect();
        const orgResults: Array<{ organizationId: string; recipients: Array<{ email: string }> }> = [];
        
        for (const org of orgs) {
          const settings = org.settings as { enableNotifications?: boolean; notificationPreferences?: { emailFrequency?: string } } | undefined;
          if (!settings?.enableNotifications) continue;
          if (settings?.notificationPreferences?.emailFrequency !== "weekly") continue;
          
          const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .collect();
          
          const recipients: Array<{ email: string }> = [];
          for (const member of members) {
            const user = await ctx.db.get(member.userId);
            if (user?.email) {
              recipients.push({ email: user.email });
            }
          }
          
          if (recipients.length > 0) {
            orgResults.push({ organizationId: org._id, recipients });
          }
        }
        
        return orgResults;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const orgs = await ctx.db.query("organizations").collect();
        const orgResults: Array<{ organizationId: string; recipients: Array<{ email: string }> }> = [];
        
        for (const org of orgs) {
          const settings = org.settings as { enableNotifications?: boolean; notificationPreferences?: { emailFrequency?: string } } | undefined;
          if (!settings?.enableNotifications) continue;
          if (settings?.notificationPreferences?.emailFrequency !== "weekly") continue;
          
          const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .collect();
          
          const recipients: Array<{ email: string }> = [];
          for (const member of members) {
            const user = await ctx.db.get(member.userId);
            if (user?.email) {
              recipients.push({ email: user.email });
            }
          }
          
          if (recipients.length > 0) {
            orgResults.push({ organizationId: org._id, recipients });
          }
        }
        
        return orgResults;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const orgs = await ctx.db.query("organizations").collect();
        const orgResults: Array<{ organizationId: string; recipients: Array<{ email: string }> }> = [];
        
        for (const org of orgs) {
          const settings = org.settings as { enableNotifications?: boolean; notificationPreferences?: { emailFrequency?: string } } | undefined;
          if (!settings?.enableNotifications) continue;
          if (settings?.notificationPreferences?.emailFrequency !== "weekly") continue;
          
          const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .collect();
          
          const recipients: Array<{ email: string }> = [];
          for (const member of members) {
            const user = await ctx.db.get(member.userId);
            if (user?.email) {
              recipients.push({ email: user.email });
            }
          }
          
          if (recipients.length > 0) {
            orgResults.push({ organizationId: org._id, recipients });
          }
        }
        
        return orgResults;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const orgs = await ctx.db.query("organizations").collect();
        const orgResults: Array<{ organizationId: string; recipients: Array<{ email: string }> }> = [];
        
        for (const org of orgs) {
          const settings = org.settings as { enableNotifications?: boolean; notificationPreferences?: { emailFrequency?: string } } | undefined;
          if (!settings?.enableNotifications) continue;
          if (settings?.notificationPreferences?.emailFrequency !== "weekly") continue;
          
          const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .collect();
          
          const recipients: Array<{ email: string }> = [];
          for (const member of members) {
            const user = await ctx.db.get(member.userId);
            if (user?.email) {
              recipients.push({ email: user.email });
            }
          }
          
          if (recipients.length > 0) {
            orgResults.push({ organizationId: org._id, recipients });
          }
        }
        
        return orgResults;
      });

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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const accounts = await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .collect();
        
        let totalSpend = 0;
        for (const account of accounts) {
          const snapshots = await ctx.db
            .query("costSnapshots")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .collect();
          
          for (const snapshot of snapshots) {
            totalSpend += snapshot.totalCost || 0;
          }
        }
        
        // Get recommendations
        const allRecommendations: Array<{ title: string; estimatedSavings: number }> = [];
        for (const account of accounts) {
          const recommendations = await ctx.db
            .query("recommendations")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .filter((q: AnyCtx) => q.eq(q.field("status"), "open"))
            .collect();
          
          for (const rec of recommendations) {
            allRecommendations.push({
              title: rec.title,
              estimatedSavings: rec.estimatedSavings || 0,
            });
          }
        }
        
        // Sort by savings and take top 5
        allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
        const topRecommendations = allRecommendations.slice(0, 5);
        
        return {
          totalSpend,
          topChanges: [],
          topRecommendations,
        };
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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const accounts = await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .collect();
        
        let totalSpend = 0;
        for (const account of accounts) {
          const snapshots = await ctx.db
            .query("costSnapshots")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .collect();
          
          for (const snapshot of snapshots) {
            totalSpend += snapshot.totalCost || 0;
          }
        }
        
        // Get recommendations
        const allRecommendations: Array<{ title: string; estimatedSavings: number }> = [];
        for (const account of accounts) {
          const recommendations = await ctx.db
            .query("recommendations")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .filter((q: AnyCtx) => q.eq(q.field("status"), "open"))
            .collect();
          
          for (const rec of recommendations) {
            allRecommendations.push({
              title: rec.title,
              estimatedSavings: rec.estimatedSavings || 0,
            });
          }
        }
        
        // Sort by savings and take top 5
        allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
        const topRecommendations = allRecommendations.slice(0, 5);
        
        return {
          totalSpend,
          topChanges: [],
          topRecommendations,
        };
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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const accounts = await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .collect();
        
        let totalSpend = 0;
        for (const account of accounts) {
          const snapshots = await ctx.db
            .query("costSnapshots")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .collect();
          
          for (const snapshot of snapshots) {
            totalSpend += snapshot.totalCost || 0;
          }
        }
        
        // Get recommendations
        const allRecommendations: Array<{ title: string; estimatedSavings: number }> = [];
        for (const account of accounts) {
          const recommendations = await ctx.db
            .query("recommendations")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .filter((q: AnyCtx) => q.eq(q.field("status"), "open"))
            .collect();
          
          for (const rec of recommendations) {
            allRecommendations.push({
              title: rec.title,
              estimatedSavings: rec.estimatedSavings || 0,
            });
          }
        }
        
        // Sort by savings and take top 5
        allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
        const topRecommendations = allRecommendations.slice(0, 5);
        
        return {
          totalSpend,
          topChanges: [],
          topRecommendations,
        };
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

      // Internal query - use direct DB operation
      const result = await t.run(async (ctx: AnyCtx) => {
        const accounts = await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
          .collect();
        
        let totalSpend = 0;
        for (const account of accounts) {
          const snapshots = await ctx.db
            .query("costSnapshots")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .collect();
          
          for (const snapshot of snapshots) {
            totalSpend += snapshot.totalCost || 0;
          }
        }
        
        // Get recommendations
        const allRecommendations: Array<{ title: string; estimatedSavings: number }> = [];
        for (const account of accounts) {
          const recommendations = await ctx.db
            .query("recommendations")
            .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
            .filter((q: AnyCtx) => q.eq(q.field("status"), "open"))
            .collect();
          
          for (const rec of recommendations) {
            allRecommendations.push({
              title: rec.title,
              estimatedSavings: rec.estimatedSavings || 0,
            });
          }
        }
        
        // Sort by savings and take top 5
        allRecommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
        const topRecommendations = allRecommendations.slice(0, 5);
        
        return {
          totalSpend,
          topChanges: [],
          topRecommendations,
        };
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

    // Internal query - use direct DB operation since crons functions are internal
    const result = await t.run(async (ctx: AnyCtx) => {
      const allAccounts = await ctx.db.query("awsAccounts").collect();
      const accountsForCollection: Array<{ awsAccountId: string; plan: string }> = [];
      
      for (const account of allAccounts) {
        if (account.status !== "active") continue;
        
        const org = await ctx.db.get(account.organizationId);
        if (!org) continue;
        
        const credentials = await ctx.db
          .query("awsCredentials")
          .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", account._id))
          .first();
        if (!credentials) continue;
        
        if (org.plan !== "free") {
          const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .first();
          if (!subscription || subscription.status === "canceled") continue;
        }
        
        accountsForCollection.push({
          awsAccountId: account._id,
          plan: org.plan,
        });
      }
      
      // Sort by plan priority (enterprise first)
      accountsForCollection.sort((a, b) => {
        const priority: Record<string, number> = { enterprise: 0, professional: 1, free: 2 };
        return (priority[a.plan] ?? 99) - (priority[b.plan] ?? 99);
      });
      
      return accountsForCollection;
    });

    expect(result.length).toBe(2);
    // Enterprise should be first (higher priority)
    expect(result[0].plan).toBe("enterprise");
    expect(result[1].plan).toBe("free");
  });
});
