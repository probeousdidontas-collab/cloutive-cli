/**
 * Dashboard Queries
 *
 * Implements US-024: Implement cost dashboard page
 *
 * Features:
 * - Get cost snapshots for an organization (aggregated across accounts)
 * - Get top recommendations with estimated savings
 * - Get cost breakdown by service
 * - Get cost trend over time
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { isTestMode } from "./functions";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// Note: Test mode is handled by isTestMode() from functions.ts

// ============================================================================
// Test Mode Sample Data
// ============================================================================

// Simple seeded random for deterministic test data
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Generate sample cost snapshots for the last 30 days
function generateTestCostSnapshots() {
  const snapshots = [];
  const now = new Date();
  const testAwsAccountId = "test-aws-account-id" as Id<"awsAccounts">;
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    // Create realistic daily variation (weekends are lower, seeded variation)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 0.7 : 1.0;
    // Use seeded random based on day index for deterministic results
    const randomVariation = 0.85 + seededRandom(i * 7) * 0.3; // 85% to 115%
    
    // Base costs for each service (with seeded variation)
    const ec2Cost = 450 * baseMultiplier * randomVariation;
    const s3Cost = 120 * baseMultiplier * (0.9 + seededRandom(i * 11) * 0.2);
    const rdsCost = 180 * baseMultiplier * randomVariation;
    const lambdaCost = 45 * (0.8 + seededRandom(i * 13) * 0.4);
    const cloudfrontCost = 65 * (0.9 + seededRandom(i * 17) * 0.2);
    const dynamodbCost = 35 * (0.85 + seededRandom(i * 19) * 0.3);
    
    const serviceBreakdown: Record<string, number> = {
      "Amazon EC2": Math.round(ec2Cost * 100) / 100,
      "Amazon S3": Math.round(s3Cost * 100) / 100,
      "Amazon RDS": Math.round(rdsCost * 100) / 100,
      "AWS Lambda": Math.round(lambdaCost * 100) / 100,
      "Amazon CloudFront": Math.round(cloudfrontCost * 100) / 100,
      "Amazon DynamoDB": Math.round(dynamodbCost * 100) / 100,
    };
    
    const totalCost = Object.values(serviceBreakdown).reduce((sum, cost) => sum + cost, 0);
    
    // Region breakdown (roughly 60% us-east-1, 25% us-west-2, 15% eu-west-1)
    const regionBreakdown: Record<string, number> = {
      "us-east-1": Math.round(totalCost * 0.60 * 100) / 100,
      "us-west-2": Math.round(totalCost * 0.25 * 100) / 100,
      "eu-west-1": Math.round(totalCost * 0.15 * 100) / 100,
    };
    
    snapshots.push({
      _id: `test-snapshot-${i}` as Id<"costSnapshots">,
      _creationTime: date.getTime(),
      awsAccountId: testAwsAccountId,
      date: dateStr,
      totalCost: Math.round(totalCost * 100) / 100,
      serviceBreakdown,
      regionBreakdown,
      createdAt: date.getTime(),
      updatedAt: date.getTime(),
    });
  }
  
  return snapshots;
}

// Generate sample recommendations
function generateTestRecommendations() {
  const testAwsAccountId = "test-aws-account-id" as Id<"awsAccounts">;
  const now = Date.now();
  
  return [
    {
      _id: "test-rec-1" as Id<"recommendations">,
      _creationTime: now - 2 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "rightsizing" as const,
      title: "Rightsize EC2 instance i-0abc123def456",
      description: "This m5.xlarge instance has averaged 15% CPU utilization over the past 14 days. Consider downsizing to m5.large to save approximately $89/month while maintaining adequate performance headroom.",
      estimatedSavings: 89,
      status: "open" as const,
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
      updatedAt: now - 2 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "test-rec-2" as Id<"recommendations">,
      _creationTime: now - 5 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "unused_resource" as const,
      title: "Delete unattached EBS volume vol-0def789",
      description: "This 500GB gp3 EBS volume has been unattached for 45 days. If the data is no longer needed, deleting this volume will save $40/month in storage costs.",
      estimatedSavings: 40,
      status: "open" as const,
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
      updatedAt: now - 5 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "test-rec-3" as Id<"recommendations">,
      _creationTime: now - 7 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "reserved_instance" as const,
      title: "Purchase Reserved Instance for RDS db-prod-01",
      description: "Your db.r5.large RDS instance has been running continuously for 6 months. Purchasing a 1-year Reserved Instance with no upfront payment would reduce costs by 35%.",
      estimatedSavings: 156,
      status: "open" as const,
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
      updatedAt: now - 7 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "test-rec-4" as Id<"recommendations">,
      _creationTime: now - 10 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "idle_resource" as const,
      title: "Stop idle EC2 instance i-0xyz987654",
      description: "This t3.medium instance in us-west-2 has had no network activity and minimal CPU usage for 21 days. Consider stopping or terminating if no longer needed.",
      estimatedSavings: 30,
      status: "open" as const,
      createdAt: now - 10 * 24 * 60 * 60 * 1000,
      updatedAt: now - 10 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "test-rec-5" as Id<"recommendations">,
      _creationTime: now - 12 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "storage_optimization" as const,
      title: "Enable S3 Intelligent-Tiering for bucket 'logs-archive'",
      description: "This 2TB S3 bucket contains mostly cold data accessed less than once per month. Enabling Intelligent-Tiering would automatically move infrequently accessed objects to lower-cost tiers.",
      estimatedSavings: 45,
      status: "open" as const,
      createdAt: now - 12 * 24 * 60 * 60 * 1000,
      updatedAt: now - 12 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "test-rec-6" as Id<"recommendations">,
      _creationTime: now - 14 * 24 * 60 * 60 * 1000,
      awsAccountId: testAwsAccountId,
      type: "savings_plan" as const,
      title: "Consider Compute Savings Plan",
      description: "Based on your consistent compute usage pattern, a 1-year Compute Savings Plan with $500/hour commitment would provide 20% savings across EC2, Lambda, and Fargate.",
      estimatedSavings: 200,
      status: "open" as const,
      createdAt: now - 14 * 24 * 60 * 60 * 1000,
      updatedAt: now - 14 * 24 * 60 * 60 * 1000,
    },
  ];
}

// Calculate test mode summary from sample data
function generateTestSummary() {
  const snapshots = generateTestCostSnapshots();
  const recommendations = generateTestRecommendations();
  
  // Get current and previous month dates
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const currentMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
  
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
  const prevMonthEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-31`;
  
  // Calculate costs from snapshots
  let currentMonthCost = 0;
  let previousMonthCost = 0;
  const serviceBreakdown: Record<string, number> = {};
  
  for (const snapshot of snapshots) {
    if (snapshot.date >= currentMonthStart && snapshot.date <= currentMonthEnd) {
      currentMonthCost += snapshot.totalCost;
      if (snapshot.serviceBreakdown) {
        for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
          serviceBreakdown[service] = (serviceBreakdown[service] || 0) + cost;
        }
      }
    }
    if (snapshot.date >= prevMonthStart && snapshot.date <= prevMonthEnd) {
      previousMonthCost += snapshot.totalCost;
    }
  }
  
  // Calculate totals from recommendations
  const totalOpenRecommendations = recommendations.filter(r => r.status === "open").length;
  const totalEstimatedSavings = recommendations
    .filter(r => r.status === "open")
    .reduce((sum, r) => sum + r.estimatedSavings, 0);
  
  // Calculate change percentage
  const costChange = previousMonthCost > 0
    ? ((currentMonthCost - previousMonthCost) / previousMonthCost) * 100
    : 0;
  
  return {
    totalAccounts: 2,
    activeAccounts: 2,
    currentMonthCost: Math.round(currentMonthCost * 100) / 100,
    previousMonthCost: Math.round(previousMonthCost * 100) / 100,
    costChange: Math.round(costChange * 100) / 100,
    serviceBreakdown,
    totalOpenRecommendations,
    totalEstimatedSavings,
  };
}

/**
 * Get all AWS accounts for an organization.
 */
async function getOrgAwsAccounts(
  ctx: QueryCtx,
  organizationId: Id<"organizations">
): Promise<Doc<"awsAccounts">[]> {
  return await ctx.db
    .query("awsAccounts")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
}

/**
 * Get cost snapshots for dashboard.
 * Returns snapshots from all AWS accounts in the organization.
 * In test mode, returns sample cost data for demonstration.
 */
export const getCostSnapshots = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    startDate: v.optional(v.string()), // YYYY-MM-DD format
    endDate: v.optional(v.string()),   // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const { organizationId, startDate, endDate } = args;

    // In test mode, return sample cost data
    if (isTestMode()) {
      let snapshots = generateTestCostSnapshots();

      // Filter by date range if provided
      if (startDate) {
        snapshots = snapshots.filter((s) => s.date >= startDate);
      }
      if (endDate) {
        snapshots = snapshots.filter((s) => s.date <= endDate);
      }

      return snapshots;
    }

    // Require organization ID when not in test mode
    if (!organizationId) {
      return [];
    }

    // Verify organization exists
    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      return [];
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all cost snapshots for these accounts
    const allSnapshots: Doc<"costSnapshots">[] = [];
    
    for (const awsAccountId of awsAccountIds) {
      const snapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();
      
      allSnapshots.push(...snapshots);
    }

    // Filter by date range if provided
    let filteredSnapshots = allSnapshots;
    
    if (startDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.date >= startDate);
    }
    
    if (endDate) {
      filteredSnapshots = filteredSnapshots.filter((s) => s.date <= endDate);
    }

    // Sort by date
    filteredSnapshots.sort((a, b) => a.date.localeCompare(b.date));

    return filteredSnapshots;
  },
});

/**
 * Get top recommendations for dashboard.
 * Returns open recommendations sorted by estimated savings, limited to top N.
 * In test mode, returns sample recommendations.
 */
export const getTopRecommendations = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId, limit = 5 } = args;

    // In test mode, return sample recommendations
    if (isTestMode()) {
      const recommendations = generateTestRecommendations();
      // Sort by estimated savings (descending) and limit
      return recommendations
        .filter((r) => r.status === "open")
        .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
        .slice(0, limit);
    }

    // Require organization ID when not in test mode
    if (!organizationId) {
      return [];
    }

    // Verify organization exists
    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      return [];
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all recommendations for these accounts
    const allRecommendations: Doc<"recommendations">[] = [];
    
    for (const awsAccountId of awsAccountIds) {
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();
      
      allRecommendations.push(...recommendations);
    }

    // Filter to only open recommendations
    const openRecommendations = allRecommendations.filter(
      (r) => r.status === "open"
    );

    // Sort by estimated savings (descending) and limit
    const topRecommendations = openRecommendations
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
      .slice(0, limit);

    return topRecommendations;
  },
});

/**
 * Get dashboard summary data.
 * Returns aggregated cost data and statistics.
 * In test mode, returns summary calculated from sample data.
 */
export const getDashboardSummary = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { organizationId } = args;

    // In test mode, return summary from sample data
    if (isTestMode()) {
      return generateTestSummary();
    }

    // Require organization ID when not in test mode
    if (!organizationId) {
      return null;
    }

    // Verify organization exists
    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      return null;
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);
    const activeAccounts = awsAccounts.filter((a) => a.status === "active");

    // Get date ranges for current and previous month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const currentMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
    
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
    const prevMonthEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-31`;

    // Collect all snapshots and recommendations
    let currentMonthCost = 0;
    let previousMonthCost = 0;
    const serviceBreakdown: Record<string, number> = {};
    let totalOpenRecommendations = 0;
    let totalEstimatedSavings = 0;

    for (const account of awsAccounts) {
      // Get snapshots for this account
      const snapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      // Calculate current month total
      for (const snapshot of snapshots) {
        if (snapshot.date >= currentMonthStart && snapshot.date <= currentMonthEnd) {
          currentMonthCost += snapshot.totalCost;
          
          // Aggregate service breakdown
          if (snapshot.serviceBreakdown) {
            for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
              serviceBreakdown[service] = (serviceBreakdown[service] || 0) + cost;
            }
          }
        }
        
        // Calculate previous month total
        if (snapshot.date >= prevMonthStart && snapshot.date <= prevMonthEnd) {
          previousMonthCost += snapshot.totalCost;
        }
      }

      // Get recommendations for this account
      const recommendations = await ctx.db
        .query("recommendations")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      const openRecs = recommendations.filter((r) => r.status === "open");
      totalOpenRecommendations += openRecs.length;
      totalEstimatedSavings += openRecs.reduce((sum, r) => sum + r.estimatedSavings, 0);
    }

    // Calculate month-over-month change
    const costChange = previousMonthCost > 0
      ? ((currentMonthCost - previousMonthCost) / previousMonthCost) * 100
      : 0;

    return {
      totalAccounts: awsAccounts.length,
      activeAccounts: activeAccounts.length,
      currentMonthCost,
      previousMonthCost,
      costChange,
      serviceBreakdown,
      totalOpenRecommendations,
      totalEstimatedSavings,
    };
  },
});

/**
 * Get connected AWS accounts for dashboard display.
 * Returns account name, number, and status for all accounts in the organization.
 * In test mode, returns sample accounts.
 */
export const getConnectedAccounts = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { organizationId } = args;

    // In test mode, return sample accounts
    if (isTestMode()) {
      return [
        {
          _id: "test-account-1" as Id<"awsAccounts">,
          name: "Production",
          accountNumber: "123456789012",
          status: "active" as const,
        },
        {
          _id: "test-account-2" as Id<"awsAccounts">,
          name: "Development",
          accountNumber: "987654321098",
          status: "active" as const,
        },
      ];
    }

    if (!organizationId) {
      return [];
    }

    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      return [];
    }

    const awsAccounts = await getOrgAwsAccounts(ctx, organizationId);

    return awsAccounts.map((account) => ({
      _id: account._id,
      name: account.name,
      accountNumber: account.accountNumber,
      status: account.status,
    }));
  },
});
