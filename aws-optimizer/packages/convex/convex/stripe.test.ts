/**
 * Stripe Billing Integration Tests
 *
 * Tests for US-032: Set up Stripe billing integration
 * 
 * Covers:
 * - Plan tier definitions (Free, Pro, Enterprise)
 * - Customer management
 * - Subscription management
 * - Usage-based pricing for AI analysis runs
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
} from "./test.helpers";
import {
  PLAN_TIERS,
  getPlanLimits,
  canAddAwsAccount,
  getUsagePricePerRun,
  type PlanTier,
} from "./stripe";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Stripe Billing Integration", () => {
  describe("Plan Tier Definitions", () => {
    it("should define Free tier with 1 AWS account limit", () => {
      expect(PLAN_TIERS.free).toBeDefined();
      expect(PLAN_TIERS.free.name).toBe("Free");
      expect(PLAN_TIERS.free.maxAwsAccounts).toBe(1);
      expect(PLAN_TIERS.free.priceId).toBeNull();
    });

    it("should define Starter tier with 3 AWS account limit", () => {
      expect(PLAN_TIERS.starter).toBeDefined();
      expect(PLAN_TIERS.starter.name).toBe("Starter");
      expect(PLAN_TIERS.starter.maxAwsAccounts).toBe(3);
      expect(PLAN_TIERS.starter.priceId).toBeDefined();
    });

    it("should define Professional tier with 5 AWS account limit", () => {
      expect(PLAN_TIERS.professional).toBeDefined();
      expect(PLAN_TIERS.professional.name).toBe("Professional");
      expect(PLAN_TIERS.professional.maxAwsAccounts).toBe(5);
      expect(PLAN_TIERS.professional.priceId).toBeDefined();
    });

    it("should define Enterprise tier with unlimited AWS accounts", () => {
      expect(PLAN_TIERS.enterprise).toBeDefined();
      expect(PLAN_TIERS.enterprise.name).toBe("Enterprise");
      expect(PLAN_TIERS.enterprise.maxAwsAccounts).toBe(-1); // -1 means unlimited
      expect(PLAN_TIERS.enterprise.priceId).toBeDefined();
    });

    it("should include usage-based pricing info for AI analysis runs", () => {
      expect(PLAN_TIERS.free.includedAnalysisRuns).toBeDefined();
      expect(PLAN_TIERS.professional.includedAnalysisRuns).toBeGreaterThan(PLAN_TIERS.free.includedAnalysisRuns);
      expect(PLAN_TIERS.enterprise.includedAnalysisRuns).toBe(-1); // unlimited
    });
  });

  describe("getPlanLimits", () => {
    it("should return correct limits for free plan", () => {
      const limits = getPlanLimits("free");
      expect(limits.maxAwsAccounts).toBe(1);
      expect(limits.includedAnalysisRuns).toBe(5);
    });

    it("should return correct limits for starter plan", () => {
      const limits = getPlanLimits("starter");
      expect(limits.maxAwsAccounts).toBe(3);
      expect(limits.includedAnalysisRuns).toBe(50);
    });

    it("should return correct limits for professional plan", () => {
      const limits = getPlanLimits("professional");
      expect(limits.maxAwsAccounts).toBe(5);
      expect(limits.includedAnalysisRuns).toBe(100);
    });

    it("should return correct limits for enterprise plan", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.maxAwsAccounts).toBe(-1);
      expect(limits.includedAnalysisRuns).toBe(-1);
    });

    it("should default to free plan for unknown plans", () => {
      const limits = getPlanLimits("unknown" as PlanTier);
      expect(limits.maxAwsAccounts).toBe(1);
    });
  });

  describe("canAddAwsAccount", () => {
    it("should allow adding account when under limit", () => {
      expect(canAddAwsAccount("free", 0)).toBe(true);
      expect(canAddAwsAccount("professional", 4)).toBe(true);
    });

    it("should deny adding account when at limit", () => {
      expect(canAddAwsAccount("free", 1)).toBe(false);
      expect(canAddAwsAccount("professional", 5)).toBe(false);
    });

    it("should always allow for enterprise (unlimited)", () => {
      expect(canAddAwsAccount("enterprise", 100)).toBe(true);
      expect(canAddAwsAccount("enterprise", 1000)).toBe(true);
    });
  });

  describe("Usage-based Pricing", () => {
    it("should return $0 for runs within included limit", () => {
      // Free plan includes 5 runs
      expect(getUsagePricePerRun("free", 1)).toBe(0);
      expect(getUsagePricePerRun("free", 5)).toBe(0);
      
      // Professional plan includes 100 runs
      expect(getUsagePricePerRun("professional", 50)).toBe(0);
      expect(getUsagePricePerRun("professional", 100)).toBe(0);
    });

    it("should return usage price for runs exceeding included limit", () => {
      // Free plan: overage at $0.50/run
      expect(getUsagePricePerRun("free", 6)).toBe(0.50);
      expect(getUsagePricePerRun("free", 10)).toBe(0.50);
      
      // Professional plan: overage at $0.25/run
      expect(getUsagePricePerRun("professional", 101)).toBe(0.25);
    });

    it("should return $0 for enterprise (unlimited)", () => {
      expect(getUsagePricePerRun("enterprise", 1000)).toBe(0);
    });
  });

  describe("Customer Management", () => {
    it("should create organization with subscription data", async () => {
      const t = createTestConvex();
      
      const org = await createMockOrganization(t, {
        name: "Test Company",
        slug: "test-company",
        plan: "free",
      });

      expect(org._id).toBeDefined();
      expect(org.plan).toBe("free");
    });

    it("should link subscription to organization", async () => {
      const t = createTestConvex();
      
      const org = await createMockOrganization(t, { plan: "professional" });
      const now = Date.now();
      
      // Create subscription linked to org
      const subscriptionId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("subscriptions", {
          organizationId: org._id,
          stripeCustomerId: "cus_test123",
          planId: "price_pro_monthly",
          status: "active",
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
        });
      });

      expect(subscriptionId).toBeDefined();

      // Verify subscription is linked
      const subscription = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(subscriptionId);
      });

      expect(subscription?.organizationId).toBe(org._id);
      expect(subscription?.status).toBe("active");
    });
  });

  describe("Subscription Status Handling", () => {
    it("should handle active subscription status", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const now = Date.now();

      const subscriptionId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("subscriptions", {
          organizationId: org._id,
          stripeCustomerId: "cus_test",
          planId: "price_pro",
          status: "active",
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
        });
      });

      const subscription = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(subscriptionId);
      });

      expect(subscription?.status).toBe("active");
    });

    it("should handle canceled subscription status", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const now = Date.now();

      const subscriptionId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("subscriptions", {
          organizationId: org._id,
          stripeCustomerId: "cus_test",
          planId: "price_pro",
          status: "canceled",
          currentPeriodEnd: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const subscription = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(subscriptionId);
      });

      expect(subscription?.status).toBe("canceled");
    });

    it("should handle past_due subscription status", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const now = Date.now();

      const subscriptionId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("subscriptions", {
          organizationId: org._id,
          stripeCustomerId: "cus_test",
          planId: "price_pro",
          status: "past_due",
          currentPeriodEnd: now - 24 * 60 * 60 * 1000, // 1 day ago
          createdAt: now,
          updatedAt: now,
        });
      });

      const subscription = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(subscriptionId);
      });

      expect(subscription?.status).toBe("past_due");
    });
  });

  describe("Usage Tracking", () => {
    it("should track analysis run usage for organization", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const now = Date.now();

      // Create usage record
      const usageId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("usageRecords", {
          organizationId: org._id,
          type: "analysis_run",
          quantity: 1,
          billingPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
          billingPeriodEnd: now,
          createdAt: now,
        });
      });

      expect(usageId).toBeDefined();

      // Query usage
      const usage = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(usageId);
      });

      expect(usage?.type).toBe("analysis_run");
      expect(usage?.quantity).toBe(1);
    });

    it("should aggregate usage within billing period", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const now = Date.now();
      const periodStart = now - 30 * 24 * 60 * 60 * 1000;

      // Create multiple usage records
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("usageRecords", {
          organizationId: org._id,
          type: "analysis_run",
          quantity: 3,
          billingPeriodStart: periodStart,
          billingPeriodEnd: now,
          createdAt: now - 10 * 24 * 60 * 60 * 1000,
        });
        await ctx.db.insert("usageRecords", {
          organizationId: org._id,
          type: "analysis_run",
          quantity: 2,
          billingPeriodStart: periodStart,
          billingPeriodEnd: now,
          createdAt: now - 5 * 24 * 60 * 60 * 1000,
        });
      });

      // Query all usage for org
      const usageRecords = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("usageRecords")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org._id)
          )
          .collect();
      });

      const totalQuantity = usageRecords.reduce(
        (sum: number, record: { quantity: number }) => sum + record.quantity,
        0
      );
      expect(totalQuantity).toBe(5);
    });
  });
});
