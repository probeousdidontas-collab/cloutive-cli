/**
 * Billing and Feature Schema Tests
 *
 * Tests for billing tables: subscriptions, budgets, alerts, reports.
 * Validates that the schema correctly supports billing, budgeting, and alerting features.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
  createMockAwsAccount,
  createMockSubscription,
  createMockBudget,
  createMockAlert,
  createMockReport,
  type SubscriptionStatus,
  type BudgetPeriod,
  type AlertSeverity,
  type AlertType,
  type ReportType,
  type ReportStatus,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Billing and Feature Schema", () => {
  describe("subscriptions Table", () => {
    it("should create a subscription with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const subscription = await createMockSubscription(t, {
        organizationId: org._id,
        stripeCustomerId: "cus_123456789",
        planId: "plan_professional",
        status: "active",
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      });

      expect(subscription._id).toBeDefined();
      expect(subscription.organizationId).toBe(org._id);
      expect(subscription.stripeCustomerId).toBe("cus_123456789");
      expect(subscription.planId).toBe("plan_professional");
      expect(subscription.status).toBe("active");
      expect(subscription.currentPeriodEnd).toBeDefined();
      expect(subscription.createdAt).toBeDefined();
      expect(subscription.updatedAt).toBeDefined();
    });

    it("should support all subscription status values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const statuses: SubscriptionStatus[] = ["active", "canceled", "past_due", "trialing", "incomplete"];

      for (const status of statuses) {
        const subscription = await createMockSubscription(t, {
          organizationId: org._id,
          status,
        });
        expect(subscription.status).toBe(status);
      }
    });

    it("should query subscriptions by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockSubscription(t, { organizationId: org1._id });
      await createMockSubscription(t, { organizationId: org2._id });

      const org1Subscriptions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Subscriptions.length).toBe(1);
    });

    it("should query subscriptions by stripeCustomerId index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockSubscription(t, {
        organizationId: org._id,
        stripeCustomerId: "cus_unique_123",
      });

      const foundSubscription = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_stripeCustomerId", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("stripeCustomerId", "cus_unique_123")
          )
          .first();
      });

      expect(foundSubscription).toBeDefined();
      expect(foundSubscription?.stripeCustomerId).toBe("cus_unique_123");
    });

    it("should query subscriptions by status index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockSubscription(t, { organizationId: org._id, status: "active" });
      await createMockSubscription(t, { organizationId: org._id, status: "active" });
      await createMockSubscription(t, { organizationId: org._id, status: "canceled" });

      const activeSubscriptions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("status", "active")
          )
          .collect();
      });

      expect(activeSubscriptions.length).toBe(2);
    });
  });

  describe("budgets Table", () => {
    it("should create a budget with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const budget = await createMockBudget(t, {
        organizationId: org._id,
        awsAccountId: awsAccount._id,
        name: "Monthly AWS Budget",
        amount: 5000,
        period: "monthly",
        alertThresholds: [50, 80, 100],
      });

      expect(budget._id).toBeDefined();
      expect(budget.organizationId).toBe(org._id);
      expect(budget.awsAccountId).toBe(awsAccount._id);
      expect(budget.name).toBe("Monthly AWS Budget");
      expect(budget.amount).toBe(5000);
      expect(budget.period).toBe("monthly");
      expect(budget.alertThresholds).toEqual([50, 80, 100]);
      expect(budget.createdAt).toBeDefined();
      expect(budget.updatedAt).toBeDefined();
    });

    it("should support all budget period values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const periods: BudgetPeriod[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

      for (const period of periods) {
        const budget = await createMockBudget(t, {
          organizationId: org._id,
          awsAccountId: awsAccount._id,
          period,
        });
        expect(budget.period).toBe(period);
      }
    });

    it("should support budget without awsAccountId (org-wide budget)", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      const budget = await createMockBudget(t, {
        organizationId: org._id,
        name: "Organization-wide Budget",
        amount: 10000,
        period: "monthly",
      });

      expect(budget.awsAccountId).toBeUndefined();
    });

    it("should query budgets by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockBudget(t, { organizationId: org1._id });
      await createMockBudget(t, { organizationId: org1._id });
      await createMockBudget(t, { organizationId: org2._id });

      const org1Budgets = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("budgets")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Budgets.length).toBe(2);
    });

    it("should query budgets by awsAccount index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockBudget(t, { organizationId: org._id, awsAccountId: awsAccount1._id });
      await createMockBudget(t, { organizationId: org._id, awsAccountId: awsAccount2._id });

      const account1Budgets = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("budgets")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .collect();
      });

      expect(account1Budgets.length).toBe(1);
    });
  });

  describe("alerts Table", () => {
    it("should create an alert with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const triggeredAt = Date.now();
      const alert = await createMockAlert(t, {
        organizationId: org._id,
        type: "budget_exceeded",
        title: "Budget Exceeded",
        message: "Your AWS spending has exceeded 80% of the monthly budget",
        severity: "warning",
        triggeredAt,
      });

      expect(alert._id).toBeDefined();
      expect(alert.organizationId).toBe(org._id);
      expect(alert.type).toBe("budget_exceeded");
      expect(alert.title).toBe("Budget Exceeded");
      expect(alert.message).toContain("80%");
      expect(alert.severity).toBe("warning");
      expect(alert.triggeredAt).toBe(triggeredAt);
      expect(alert.acknowledgedAt).toBeUndefined();
      expect(alert.createdAt).toBeDefined();
      expect(alert.updatedAt).toBeDefined();
    });

    it("should support all alert types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const types: AlertType[] = ["budget_exceeded", "anomaly_detected", "recommendation_available", "cost_spike", "resource_idle"];

      for (const type of types) {
        const alert = await createMockAlert(t, {
          organizationId: org._id,
          type,
        });
        expect(alert.type).toBe(type);
      }
    });

    it("should support all severity levels", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const severities: AlertSeverity[] = ["info", "warning", "critical"];

      for (const severity of severities) {
        const alert = await createMockAlert(t, {
          organizationId: org._id,
          severity,
        });
        expect(alert.severity).toBe(severity);
      }
    });

    it("should support acknowledgedAt for acknowledged alerts", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const acknowledgedAt = Date.now();

      const alert = await createMockAlert(t, {
        organizationId: org._id,
        acknowledgedAt,
      });

      expect(alert.acknowledgedAt).toBe(acknowledgedAt);
    });

    it("should query alerts by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockAlert(t, { organizationId: org1._id });
      await createMockAlert(t, { organizationId: org1._id });
      await createMockAlert(t, { organizationId: org2._id });

      const org1Alerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Alerts.length).toBe(2);
    });

    it("should query alerts by type index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAlert(t, { organizationId: org._id, type: "budget_exceeded" });
      await createMockAlert(t, { organizationId: org._id, type: "budget_exceeded" });
      await createMockAlert(t, { organizationId: org._id, type: "anomaly_detected" });

      const budgetAlerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_type", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("type", "budget_exceeded")
          )
          .collect();
      });

      expect(budgetAlerts.length).toBe(2);
    });

    it("should query alerts by severity index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAlert(t, { organizationId: org._id, severity: "critical" });
      await createMockAlert(t, { organizationId: org._id, severity: "warning" });
      await createMockAlert(t, { organizationId: org._id, severity: "critical" });

      const criticalAlerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_severity", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("severity", "critical")
          )
          .collect();
      });

      expect(criticalAlerts.length).toBe(2);
    });

    it("should query alerts by triggeredAt for time-series", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAlert(t, { organizationId: org._id });
      await createMockAlert(t, { organizationId: org._id });

      const recentAlerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_triggeredAt")
          .order("desc")
          .take(10);
      });

      expect(recentAlerts.length).toBe(2);
    });
  });

  describe("reports Table", () => {
    it("should create a report with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const generatedAt = Date.now();
      const report = await createMockReport(t, {
        organizationId: org._id,
        type: "cost_analysis",
        title: "Monthly Cost Analysis Report",
        status: "completed",
        fileUrl: "https://storage.example.com/reports/report-123.pdf",
        generatedAt,
      });

      expect(report._id).toBeDefined();
      expect(report.organizationId).toBe(org._id);
      expect(report.type).toBe("cost_analysis");
      expect(report.title).toBe("Monthly Cost Analysis Report");
      expect(report.status).toBe("completed");
      expect(report.fileUrl).toBe("https://storage.example.com/reports/report-123.pdf");
      expect(report.generatedAt).toBe(generatedAt);
      expect(report.createdAt).toBeDefined();
      expect(report.updatedAt).toBeDefined();
    });

    it("should support all report types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const types: ReportType[] = ["cost_analysis", "savings_summary", "resource_inventory", "recommendation_summary", "executive_summary"];

      for (const type of types) {
        const report = await createMockReport(t, {
          organizationId: org._id,
          type,
        });
        expect(report.type).toBe(type);
      }
    });

    it("should support all report status values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const statuses: ReportStatus[] = ["pending", "generating", "completed", "failed"];

      for (const status of statuses) {
        const report = await createMockReport(t, {
          organizationId: org._id,
          status,
        });
        expect(report.status).toBe(status);
      }
    });

    it("should support optional fileUrl for pending/generating reports", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      const report = await createMockReport(t, {
        organizationId: org._id,
        status: "generating",
      });

      expect(report.fileUrl).toBeUndefined();
    });

    it("should query reports by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockReport(t, { organizationId: org1._id });
      await createMockReport(t, { organizationId: org1._id });
      await createMockReport(t, { organizationId: org2._id });

      const org1Reports = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("reports")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Reports.length).toBe(2);
    });

    it("should query reports by type index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockReport(t, { organizationId: org._id, type: "cost_analysis" });
      await createMockReport(t, { organizationId: org._id, type: "cost_analysis" });
      await createMockReport(t, { organizationId: org._id, type: "savings_summary" });

      const costReports = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("reports")
          .withIndex("by_type", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("type", "cost_analysis")
          )
          .collect();
      });

      expect(costReports.length).toBe(2);
    });

    it("should query reports by status index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockReport(t, { organizationId: org._id, status: "completed" });
      await createMockReport(t, { organizationId: org._id, status: "completed" });
      await createMockReport(t, { organizationId: org._id, status: "pending" });

      const completedReports = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("reports")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("status", "completed")
          )
          .collect();
      });

      expect(completedReports.length).toBe(2);
    });

    it("should query reports by generatedAt for time-series", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockReport(t, { organizationId: org._id, status: "completed", generatedAt: Date.now() - 1000 });
      await createMockReport(t, { organizationId: org._id, status: "completed", generatedAt: Date.now() });

      const recentReports = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("reports")
          .withIndex("by_generatedAt")
          .order("desc")
          .take(10);
      });

      expect(recentReports.length).toBe(2);
    });
  });

  describe("Multi-tenancy Support", () => {
    it("should isolate billing data between organizations", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { name: "Org 1", slug: "org-1" });
      const org2 = await createMockOrganization(t, { name: "Org 2", slug: "org-2" });

      await createMockSubscription(t, { organizationId: org1._id });
      await createMockSubscription(t, { organizationId: org2._id });

      const org1Subscriptions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Subscriptions.length).toBe(1);
    });

    it("should link budgets to specific AWS accounts within an organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      const budget = await createMockBudget(t, {
        organizationId: org._id,
        awsAccountId: awsAccount._id,
        name: "Production Account Budget",
        amount: 10000,
      });

      expect(budget.organizationId).toBe(org._id);
      expect(budget.awsAccountId).toBe(awsAccount._id);
    });
  });
});
