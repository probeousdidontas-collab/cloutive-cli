/**
 * AI and Analysis Schema Tests
 *
 * Tests for AI and analysis tables: analysisRuns, costSnapshots, resources, recommendations.
 * Validates that the schema correctly supports cost data and AI-generated recommendations.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
  createMockAwsAccount,
  createMockAnalysisRun,
  createMockCostSnapshot,
  createMockResource,
  createMockRecommendation,
  type AnalysisRunStatus,
  type AnalysisRunType,
  type RecommendationStatus,
  type RecommendationType,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("AI and Analysis Schema", () => {
  describe("analysisRuns Table", () => {
    it("should create an analysis run with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const analysisRun = await createMockAnalysisRun(t, {
        organizationId: org._id,
        type: "full_analysis",
        status: "running",
      });

      expect(analysisRun._id).toBeDefined();
      expect(analysisRun.organizationId).toBe(org._id);
      expect(analysisRun.type).toBe("full_analysis");
      expect(analysisRun.status).toBe("running");
      expect(analysisRun.startedAt).toBeDefined();
      expect(analysisRun.createdAt).toBeDefined();
      expect(analysisRun.updatedAt).toBeDefined();
    });

    it("should support all analysis run types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const types: AnalysisRunType[] = ["full_analysis", "cost_snapshot", "resource_discovery", "recommendation_refresh"];

      for (const type of types) {
        const run = await createMockAnalysisRun(t, {
          organizationId: org._id,
          type,
        });
        expect(run.type).toBe(type);
      }
    });

    it("should support all status values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const statuses: AnalysisRunStatus[] = ["pending", "running", "completed", "failed"];

      for (const status of statuses) {
        const run = await createMockAnalysisRun(t, {
          organizationId: org._id,
          status,
        });
        expect(run.status).toBe(status);
      }
    });

    it("should support completedAt for finished runs", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const completedAt = Date.now();

      const run = await createMockAnalysisRun(t, {
        organizationId: org._id,
        status: "completed",
        completedAt,
      });

      expect(run.completedAt).toBe(completedAt);
    });

    it("should query analysis runs by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockAnalysisRun(t, { organizationId: org1._id });
      await createMockAnalysisRun(t, { organizationId: org1._id });
      await createMockAnalysisRun(t, { organizationId: org2._id });

      const org1Runs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("analysisRuns")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Runs.length).toBe(2);
    });

    it("should query analysis runs by status index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAnalysisRun(t, { organizationId: org._id, status: "running" });
      await createMockAnalysisRun(t, { organizationId: org._id, status: "completed" });
      await createMockAnalysisRun(t, { organizationId: org._id, status: "completed" });

      const completedRuns = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("analysisRuns")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("status", "completed")
          )
          .collect();
      });

      expect(completedRuns.length).toBe(2);
    });

    it("should query analysis runs by startedAt for time-series", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAnalysisRun(t, { organizationId: org._id });
      await createMockAnalysisRun(t, { organizationId: org._id });

      const recentRuns = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("analysisRuns")
          .withIndex("by_startedAt")
          .order("desc")
          .take(10);
      });

      expect(recentRuns.length).toBe(2);
    });
  });

  describe("costSnapshots Table", () => {
    it("should create a cost snapshot with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const snapshot = await createMockCostSnapshot(t, {
        awsAccountId: awsAccount._id,
        date: "2025-01-25",
        totalCost: 1234.56,
      });

      expect(snapshot._id).toBeDefined();
      expect(snapshot.awsAccountId).toBe(awsAccount._id);
      expect(snapshot.date).toBe("2025-01-25");
      expect(snapshot.totalCost).toBe(1234.56);
      expect(snapshot.createdAt).toBeDefined();
      expect(snapshot.updatedAt).toBeDefined();
    });

    it("should support breakdown by service", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const serviceBreakdown = {
        "Amazon EC2": 500.00,
        "Amazon S3": 150.25,
        "Amazon RDS": 300.00,
        "AWS Lambda": 25.50,
      };

      const snapshot = await createMockCostSnapshot(t, {
        awsAccountId: awsAccount._id,
        totalCost: 975.75,
        serviceBreakdown,
      });

      expect(snapshot.serviceBreakdown).toEqual(serviceBreakdown);
    });

    it("should support breakdown by region", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const regionBreakdown = {
        "us-east-1": 800.00,
        "us-west-2": 300.00,
        "eu-west-1": 150.00,
      };

      const snapshot = await createMockCostSnapshot(t, {
        awsAccountId: awsAccount._id,
        totalCost: 1250.00,
        regionBreakdown,
      });

      expect(snapshot.regionBreakdown).toEqual(regionBreakdown);
    });

    it("should query cost snapshots by AWS account index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockCostSnapshot(t, { awsAccountId: awsAccount1._id, date: "2025-01-25" });
      await createMockCostSnapshot(t, { awsAccountId: awsAccount1._id, date: "2025-01-24" });
      await createMockCostSnapshot(t, { awsAccountId: awsAccount2._id, date: "2025-01-25" });

      const account1Snapshots = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("costSnapshots")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .collect();
      });

      expect(account1Snapshots.length).toBe(2);
    });

    it("should query cost snapshots by date for time-series", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockCostSnapshot(t, { awsAccountId: awsAccount._id, date: "2025-01-25" });
      await createMockCostSnapshot(t, { awsAccountId: awsAccount._id, date: "2025-01-24" });
      await createMockCostSnapshot(t, { awsAccountId: awsAccount._id, date: "2025-01-23" });

      const recentSnapshots = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("costSnapshots")
          .withIndex("by_date")
          .order("desc")
          .take(10);
      });

      expect(recentSnapshots.length).toBe(3);
      expect(recentSnapshots[0].date).toBe("2025-01-25");
    });

    it("should query cost snapshots by account and date combined", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockCostSnapshot(t, { awsAccountId: awsAccount._id, date: "2025-01-25" });
      await createMockCostSnapshot(t, { awsAccountId: awsAccount._id, date: "2025-01-24" });

      const accountSnapshots = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("costSnapshots")
          .withIndex("by_awsAccount_date", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount._id)
          )
          .order("desc")
          .collect();
      });

      expect(accountSnapshots.length).toBe(2);
    });
  });

  describe("resources Table", () => {
    it("should create a resource with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const resource = await createMockResource(t, {
        awsAccountId: awsAccount._id,
        resourceType: "EC2",
        resourceId: "i-1234567890abcdef0",
        name: "Production Web Server",
        region: "us-east-1",
      });

      expect(resource._id).toBeDefined();
      expect(resource.awsAccountId).toBe(awsAccount._id);
      expect(resource.resourceType).toBe("EC2");
      expect(resource.resourceId).toBe("i-1234567890abcdef0");
      expect(resource.name).toBe("Production Web Server");
      expect(resource.region).toBe("us-east-1");
      expect(resource.createdAt).toBeDefined();
      expect(resource.updatedAt).toBeDefined();
    });

    it("should support various resource types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      const resourceTypes = ["EC2", "RDS", "S3", "Lambda", "ELB", "EBS", "ElastiCache"];

      for (const resourceType of resourceTypes) {
        const resource = await createMockResource(t, {
          awsAccountId: awsAccount._id,
          resourceType,
          resourceId: `${resourceType.toLowerCase()}-123`,
        });
        expect(resource.resourceType).toBe(resourceType);
      }
    });

    it("should support tags as key-value pairs", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const tags = {
        Environment: "production",
        Team: "platform",
        CostCenter: "CC-12345",
      };

      const resource = await createMockResource(t, {
        awsAccountId: awsAccount._id,
        resourceType: "EC2",
        resourceId: "i-tagged",
        tags,
      });

      expect(resource.tags).toEqual(tags);
    });

    it("should support monthly cost estimate", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      const resource = await createMockResource(t, {
        awsAccountId: awsAccount._id,
        resourceType: "RDS",
        resourceId: "db-production",
        monthlyCost: 450.75,
      });

      expect(resource.monthlyCost).toBe(450.75);
    });

    it("should query resources by AWS account index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockResource(t, { awsAccountId: awsAccount1._id, resourceType: "EC2", resourceId: "i-1" });
      await createMockResource(t, { awsAccountId: awsAccount1._id, resourceType: "RDS", resourceId: "db-1" });
      await createMockResource(t, { awsAccountId: awsAccount2._id, resourceType: "S3", resourceId: "bucket-1" });

      const account1Resources = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("resources")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .collect();
      });

      expect(account1Resources.length).toBe(2);
    });

    it("should query resources by type index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "EC2", resourceId: "i-1" });
      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "EC2", resourceId: "i-2" });
      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "RDS", resourceId: "db-1" });

      const ec2Resources = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("resources")
          .withIndex("by_resourceType", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("resourceType", "EC2")
          )
          .collect();
      });

      expect(ec2Resources.length).toBe(2);
    });

    it("should query resources by region index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "EC2", resourceId: "i-1", region: "us-east-1" });
      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "EC2", resourceId: "i-2", region: "us-east-1" });
      await createMockResource(t, { awsAccountId: awsAccount._id, resourceType: "EC2", resourceId: "i-3", region: "us-west-2" });

      const usEast1Resources = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("resources")
          .withIndex("by_region", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("region", "us-east-1")
          )
          .collect();
      });

      expect(usEast1Resources.length).toBe(2);
    });
  });

  describe("recommendations Table", () => {
    it("should create a recommendation with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const recommendation = await createMockRecommendation(t, {
        awsAccountId: awsAccount._id,
        type: "rightsizing",
        title: "Rightsize EC2 instance i-1234567890abcdef0",
        description: "This instance is underutilized. Consider downsizing from m5.xlarge to m5.large.",
        estimatedSavings: 150.00,
        status: "open",
      });

      expect(recommendation._id).toBeDefined();
      expect(recommendation.awsAccountId).toBe(awsAccount._id);
      expect(recommendation.type).toBe("rightsizing");
      expect(recommendation.title).toBe("Rightsize EC2 instance i-1234567890abcdef0");
      expect(recommendation.description).toContain("underutilized");
      expect(recommendation.estimatedSavings).toBe(150.00);
      expect(recommendation.status).toBe("open");
      expect(recommendation.createdAt).toBeDefined();
      expect(recommendation.updatedAt).toBeDefined();
    });

    it("should support all recommendation types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const types: RecommendationType[] = [
        "rightsizing",
        "reserved_instance",
        "savings_plan",
        "unused_resource",
        "idle_resource",
        "storage_optimization",
        "network_optimization",
      ];

      for (const type of types) {
        const recommendation = await createMockRecommendation(t, {
          awsAccountId: awsAccount._id,
          type,
        });
        expect(recommendation.type).toBe(type);
      }
    });

    it("should support all status values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const statuses: RecommendationStatus[] = ["open", "implemented", "dismissed", "in_progress"];

      for (const status of statuses) {
        const recommendation = await createMockRecommendation(t, {
          awsAccountId: awsAccount._id,
          status,
        });
        expect(recommendation.status).toBe(status);
      }
    });

    it("should query recommendations by AWS account index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockRecommendation(t, { awsAccountId: awsAccount1._id, title: "Rec 1" });
      await createMockRecommendation(t, { awsAccountId: awsAccount1._id, title: "Rec 2" });
      await createMockRecommendation(t, { awsAccountId: awsAccount2._id, title: "Rec 3" });

      const account1Recommendations = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("recommendations")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .collect();
      });

      expect(account1Recommendations.length).toBe(2);
    });

    it("should query recommendations by type index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockRecommendation(t, { awsAccountId: awsAccount._id, type: "rightsizing" });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, type: "rightsizing" });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, type: "unused_resource" });

      const rightsizingRecs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("recommendations")
          .withIndex("by_type", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("type", "rightsizing")
          )
          .collect();
      });

      expect(rightsizingRecs.length).toBe(2);
    });

    it("should query recommendations by status index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockRecommendation(t, { awsAccountId: awsAccount._id, status: "open" });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, status: "open" });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, status: "implemented" });

      const openRecs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("recommendations")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("status", "open")
          )
          .collect();
      });

      expect(openRecs.length).toBe(2);
    });

    it("should query recommendations by estimated savings for prioritization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockRecommendation(t, { awsAccountId: awsAccount._id, estimatedSavings: 100 });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, estimatedSavings: 500 });
      await createMockRecommendation(t, { awsAccountId: awsAccount._id, estimatedSavings: 250 });

      const topSavings = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("recommendations")
          .withIndex("by_estimatedSavings")
          .order("desc")
          .take(10);
      });

      expect(topSavings.length).toBe(3);
      expect(topSavings[0].estimatedSavings).toBe(500);
    });
  });

  describe("Multi-tenancy and Relationships", () => {
    it("should isolate analysis data between organizations", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { name: "Org 1", slug: "org-1" });
      const org2 = await createMockOrganization(t, { name: "Org 2", slug: "org-2" });

      await createMockAnalysisRun(t, { organizationId: org1._id });
      await createMockAnalysisRun(t, { organizationId: org2._id });

      const org1Runs = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("analysisRuns")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Runs.length).toBe(1);
    });

    it("should link cost data to specific AWS accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      const snapshot = await createMockCostSnapshot(t, {
        awsAccountId: awsAccount._id,
        totalCost: 1000,
      });
      const resource = await createMockResource(t, {
        awsAccountId: awsAccount._id,
        resourceType: "EC2",
        resourceId: "i-test",
      });
      const recommendation = await createMockRecommendation(t, {
        awsAccountId: awsAccount._id,
        title: "Test Recommendation",
      });

      expect(snapshot.awsAccountId).toBe(awsAccount._id);
      expect(resource.awsAccountId).toBe(awsAccount._id);
      expect(recommendation.awsAccountId).toBe(awsAccount._id);
    });
  });
});
