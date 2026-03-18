/**
 * Seed Data for AWS Manager
 *
 * Provides realistic demo data for development and demonstrations.
 * Includes organizations, users, AWS accounts, cost data, recommendations,
 * budgets, alerts, reports, and activity logs.
 *
 * Usage:
 * - Call `seedDemoData` mutation to populate the database
 * - Call `clearSeedData` mutation to remove all seed data
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ============================================================================
// Constants
// ============================================================================

// Seed data identifier to find the demo organization
const SEED_ORG_SLUG = "acme-corp-demo";

// ============================================================================
// Helper Functions
// ============================================================================

// Simple seeded random for deterministic data generation
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Generate a date string in YYYY-MM-DD format
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Get a date N days ago from today
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// ============================================================================
// Seed Data Generators
// ============================================================================

interface SeedOrganization {
  name: string;
  slug: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  settings: Record<string, unknown>;
}

function createSeedOrganizationData(): SeedOrganization {
  return {
    name: "Acme Corporation",
    slug: SEED_ORG_SLUG,
    plan: "professional",
    settings: {
      enableNotifications: true,
      maxUsers: 25,
      defaultRegion: "us-east-1",
      notificationPreferences: {
        emailFrequency: "daily",
        alertTypes: ["budget_exceeded", "anomaly_detected", "cost_spike"],
      },
    },
  };
}

interface SeedUser {
  email: string;
  name: string;
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
  emailVerified: boolean;
  orgRole: "owner" | "admin" | "member" | "viewer";
}

function getSeedUsers(): SeedUser[] {
  return [
    {
      email: "sarah.chen@acme-demo.com",
      name: "Sarah Chen",
      role: "admin",
      status: "active",
      emailVerified: true,
      orgRole: "owner",
    },
    {
      email: "mike.johnson@acme-demo.com",
      name: "Mike Johnson",
      role: "user",
      status: "active",
      emailVerified: true,
      orgRole: "admin",
    },
    {
      email: "alex.rivera@acme-demo.com",
      name: "Alex Rivera",
      role: "user",
      status: "active",
      emailVerified: true,
      orgRole: "member",
    },
  ];
}

interface SeedAwsAccount {
  name: string;
  accountNumber: string;
  connectionType: "iam_role" | "access_key" | "sso";
  status: "active" | "inactive" | "pending" | "error";
  description: string;
  region: string;
}

function getSeedAwsAccounts(): SeedAwsAccount[] {
  return [
    {
      name: "Production",
      accountNumber: "123456789012",
      connectionType: "iam_role",
      status: "active",
      description: "Main production workloads - EC2, RDS, and application services",
      region: "us-east-1",
    },
    {
      name: "Development",
      accountNumber: "234567890123",
      connectionType: "access_key",
      status: "active",
      description: "Development and testing environment",
      region: "us-west-2",
    },
    {
      name: "Staging",
      accountNumber: "345678901234",
      connectionType: "iam_role",
      status: "active",
      description: "Pre-production staging environment",
      region: "eu-west-1",
    },
    {
      name: "Legacy Infrastructure",
      accountNumber: "456789012345",
      connectionType: "access_key",
      status: "pending",
      description: "Legacy systems pending migration - credentials need refresh",
      region: "us-east-1",
    },
  ];
}

interface CostSnapshotData {
  date: string;
  totalCost: number;
  serviceBreakdown: Record<string, number>;
  regionBreakdown: Record<string, number>;
}

function generateCostSnapshots(
  accountIndex: number,
  accountRegion: string,
  baseMultiplier: number
): CostSnapshotData[] {
  const snapshots: CostSnapshotData[] = [];
  
  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.7 : 1.0;
    
    // Use seeded random for deterministic but varied costs
    const seed = accountIndex * 1000 + i;
    const variation = 0.85 + seededRandom(seed) * 0.3;
    
    // Base service costs (scaled by account multiplier)
    const ec2Base = 450 * baseMultiplier * weekendFactor * variation;
    const s3Base = 120 * baseMultiplier * (0.9 + seededRandom(seed * 2) * 0.2);
    const rdsBase = 180 * baseMultiplier * weekendFactor * variation;
    const lambdaBase = 45 * baseMultiplier * (0.8 + seededRandom(seed * 3) * 0.4);
    const cloudfrontBase = 65 * baseMultiplier * (0.9 + seededRandom(seed * 4) * 0.2);
    const dynamodbBase = 35 * baseMultiplier * (0.85 + seededRandom(seed * 5) * 0.3);
    const ecsBase = accountIndex === 0 ? 85 * baseMultiplier * variation : 0;
    const elasticacheBase = accountIndex === 0 ? 55 * baseMultiplier * variation : 0;
    
    const serviceBreakdown: Record<string, number> = {
      "Amazon EC2": Math.round(ec2Base * 100) / 100,
      "Amazon S3": Math.round(s3Base * 100) / 100,
      "Amazon RDS": Math.round(rdsBase * 100) / 100,
      "AWS Lambda": Math.round(lambdaBase * 100) / 100,
      "Amazon CloudFront": Math.round(cloudfrontBase * 100) / 100,
      "Amazon DynamoDB": Math.round(dynamodbBase * 100) / 100,
    };
    
    if (ecsBase > 0) {
      serviceBreakdown["Amazon ECS"] = Math.round(ecsBase * 100) / 100;
    }
    if (elasticacheBase > 0) {
      serviceBreakdown["Amazon ElastiCache"] = Math.round(elasticacheBase * 100) / 100;
    }
    
    const totalCost = Object.values(serviceBreakdown).reduce((sum, cost) => sum + cost, 0);
    
    // Region breakdown based on account's primary region
    const regionBreakdown: Record<string, number> = {
      [accountRegion]: Math.round(totalCost * 0.75 * 100) / 100,
    };
    
    // Add secondary regions
    if (accountRegion !== "us-east-1") {
      regionBreakdown["us-east-1"] = Math.round(totalCost * 0.15 * 100) / 100;
    } else {
      regionBreakdown["us-west-2"] = Math.round(totalCost * 0.15 * 100) / 100;
    }
    regionBreakdown["eu-west-1"] = Math.round(totalCost * 0.10 * 100) / 100;
    
    snapshots.push({
      date: formatDate(date),
      totalCost: Math.round(totalCost * 100) / 100,
      serviceBreakdown,
      regionBreakdown,
    });
  }
  
  return snapshots;
}

interface SeedResource {
  resourceType: string;
  resourceId: string;
  name: string;
  region: string;
  tags: Record<string, string>;
  monthlyCost: number;
  accountIndex: number;
}

function getSeedResources(): SeedResource[] {
  return [
    // Production account resources
    {
      resourceType: "EC2",
      resourceId: "i-0abc123def456789a",
      name: "web-server-prod-1",
      region: "us-east-1",
      tags: { Environment: "production", Team: "platform", Application: "web" },
      monthlyCost: 156.50,
      accountIndex: 0,
    },
    {
      resourceType: "EC2",
      resourceId: "i-0abc123def456789b",
      name: "web-server-prod-2",
      region: "us-east-1",
      tags: { Environment: "production", Team: "platform", Application: "web" },
      monthlyCost: 156.50,
      accountIndex: 0,
    },
    {
      resourceType: "EC2",
      resourceId: "i-0xyz987654321fedc",
      name: "api-server-prod-1",
      region: "us-east-1",
      tags: { Environment: "production", Team: "backend", Application: "api" },
      monthlyCost: 312.00,
      accountIndex: 0,
    },
    {
      resourceType: "RDS",
      resourceId: "db-prod-primary",
      name: "postgres-prod-primary",
      region: "us-east-1",
      tags: { Environment: "production", Team: "data", Application: "database" },
      monthlyCost: 445.50,
      accountIndex: 0,
    },
    {
      resourceType: "RDS",
      resourceId: "db-prod-replica",
      name: "postgres-prod-replica",
      region: "us-east-1",
      tags: { Environment: "production", Team: "data", Application: "database" },
      monthlyCost: 345.00,
      accountIndex: 0,
    },
    {
      resourceType: "S3",
      resourceId: "acme-prod-assets",
      name: "acme-prod-assets",
      region: "us-east-1",
      tags: { Environment: "production", Team: "platform", Purpose: "static-assets" },
      monthlyCost: 89.25,
      accountIndex: 0,
    },
    {
      resourceType: "S3",
      resourceId: "acme-logs-archive",
      name: "acme-logs-archive",
      region: "us-east-1",
      tags: { Environment: "production", Team: "devops", Purpose: "log-storage" },
      monthlyCost: 156.00,
      accountIndex: 0,
    },
    {
      resourceType: "Lambda",
      resourceId: "image-processor",
      name: "image-processor",
      region: "us-east-1",
      tags: { Environment: "production", Team: "media", Application: "processing" },
      monthlyCost: 34.50,
      accountIndex: 0,
    },
    {
      resourceType: "EBS",
      resourceId: "vol-0def789abc123456",
      name: "unattached-volume-1",
      region: "us-east-1",
      tags: { Environment: "production", Status: "orphaned" },
      monthlyCost: 40.00,
      accountIndex: 0,
    },
    // Development account resources
    {
      resourceType: "EC2",
      resourceId: "i-0dev111222333444a",
      name: "dev-server-1",
      region: "us-west-2",
      tags: { Environment: "development", Team: "engineering" },
      monthlyCost: 78.25,
      accountIndex: 1,
    },
    {
      resourceType: "EC2",
      resourceId: "i-0dev555666777888b",
      name: "dev-server-idle",
      region: "us-west-2",
      tags: { Environment: "development", Team: "engineering", Status: "idle" },
      monthlyCost: 30.50,
      accountIndex: 1,
    },
    {
      resourceType: "RDS",
      resourceId: "db-dev-postgres",
      name: "postgres-dev",
      region: "us-west-2",
      tags: { Environment: "development", Team: "data" },
      monthlyCost: 125.00,
      accountIndex: 1,
    },
    {
      resourceType: "S3",
      resourceId: "acme-dev-artifacts",
      name: "acme-dev-artifacts",
      region: "us-west-2",
      tags: { Environment: "development", Team: "engineering" },
      monthlyCost: 23.50,
      accountIndex: 1,
    },
    // Staging account resources
    {
      resourceType: "EC2",
      resourceId: "i-0stg999888777666a",
      name: "staging-server-1",
      region: "eu-west-1",
      tags: { Environment: "staging", Team: "qa" },
      monthlyCost: 89.00,
      accountIndex: 2,
    },
    {
      resourceType: "RDS",
      resourceId: "db-staging-postgres",
      name: "postgres-staging",
      region: "eu-west-1",
      tags: { Environment: "staging", Team: "data" },
      monthlyCost: 145.00,
      accountIndex: 2,
    },
    {
      resourceType: "S3",
      resourceId: "acme-staging-assets",
      name: "acme-staging-assets",
      region: "eu-west-1",
      tags: { Environment: "staging", Team: "qa" },
      monthlyCost: 18.75,
      accountIndex: 2,
    },
  ];
}

interface SeedRecommendation {
  type: "rightsizing" | "reserved_instance" | "savings_plan" | "unused_resource" | "idle_resource" | "storage_optimization" | "network_optimization";
  title: string;
  description: string;
  estimatedSavings: number;
  status: "open" | "implemented" | "dismissed" | "in_progress";
  accountIndex: number;
  daysAgo: number;
}

function getSeedRecommendations(): SeedRecommendation[] {
  return [
    // Production account recommendations
    {
      type: "rightsizing",
      title: "Rightsize EC2 instance i-0xyz987654321fedc",
      description: "The api-server-prod-1 (m5.xlarge) has averaged 18% CPU utilization over the past 14 days. Consider downsizing to m5.large to save approximately $156/month while maintaining adequate performance headroom for traffic spikes.",
      estimatedSavings: 156,
      status: "open",
      accountIndex: 0,
      daysAgo: 2,
    },
    {
      type: "unused_resource",
      title: "Delete unattached EBS volume vol-0def789abc123456",
      description: "This 500GB gp3 EBS volume has been unattached for 45 days. The volume was previously attached to a terminated instance. If the data is no longer needed, deleting this volume will save $40/month.",
      estimatedSavings: 40,
      status: "open",
      accountIndex: 0,
      daysAgo: 5,
    },
    {
      type: "reserved_instance",
      title: "Purchase Reserved Instance for RDS db-prod-primary",
      description: "Your db.r5.large PostgreSQL RDS instance has been running continuously for 8 months with consistent usage. Purchasing a 1-year Reserved Instance with no upfront payment would reduce costs by 35%, saving $156/month.",
      estimatedSavings: 156,
      status: "open",
      accountIndex: 0,
      daysAgo: 7,
    },
    {
      type: "storage_optimization",
      title: "Enable S3 Intelligent-Tiering for acme-logs-archive",
      description: "This 2.3TB S3 bucket contains log files that are rarely accessed after 30 days. Enabling S3 Intelligent-Tiering would automatically move infrequently accessed objects to lower-cost storage tiers, saving approximately $78/month.",
      estimatedSavings: 78,
      status: "open",
      accountIndex: 0,
      daysAgo: 10,
    },
    {
      type: "savings_plan",
      title: "Consider Compute Savings Plan for Production",
      description: "Based on your consistent compute usage pattern over the past 3 months, a 1-year Compute Savings Plan with $400/hour commitment would provide 22% savings across EC2, Lambda, and Fargate workloads.",
      estimatedSavings: 440,
      status: "in_progress",
      accountIndex: 0,
      daysAgo: 14,
    },
    {
      type: "network_optimization",
      title: "Use S3 Transfer Acceleration for acme-prod-assets",
      description: "Analysis shows 40% of requests to this bucket originate from Asia-Pacific. Enabling S3 Transfer Acceleration could improve upload speeds by 50-500% for distant users, though costs would increase slightly.",
      estimatedSavings: -15,
      status: "dismissed",
      accountIndex: 0,
      daysAgo: 20,
    },
    // Development account recommendations
    {
      type: "idle_resource",
      title: "Stop or terminate idle EC2 instance i-0dev555666777888b",
      description: "The dev-server-idle instance (t3.medium) has had no SSH connections and minimal CPU usage for 28 days. Consider stopping this instance during off-hours or terminating if no longer needed.",
      estimatedSavings: 30,
      status: "open",
      accountIndex: 1,
      daysAgo: 3,
    },
    {
      type: "rightsizing",
      title: "Downsize RDS instance db-dev-postgres",
      description: "Your development database (db.t3.medium) averages only 5% CPU utilization. Consider downsizing to db.t3.small to save $62/month without impacting development workflows.",
      estimatedSavings: 62,
      status: "open",
      accountIndex: 1,
      daysAgo: 8,
    },
    {
      type: "storage_optimization",
      title: "Clean up old CI/CD artifacts in acme-dev-artifacts",
      description: "This bucket contains 450GB of build artifacts older than 90 days. Implementing a lifecycle policy to delete artifacts older than 30 days would reduce storage costs by approximately $8/month.",
      estimatedSavings: 8,
      status: "implemented",
      accountIndex: 1,
      daysAgo: 15,
    },
    // Staging account recommendations
    {
      type: "idle_resource",
      title: "Schedule staging environment shutdown",
      description: "The staging environment runs 24/7 but is only used during business hours (9 AM - 6 PM). Implementing scheduled start/stop would save approximately $45/month by running only 45 hours/week instead of 168.",
      estimatedSavings: 45,
      status: "open",
      accountIndex: 2,
      daysAgo: 4,
    },
    {
      type: "rightsizing",
      title: "Rightsize staging RDS instance",
      description: "The staging database (db.t3.large) is oversized for typical QA workloads. Consider using db.t3.medium to better match the lower traffic patterns in staging.",
      estimatedSavings: 72,
      status: "open",
      accountIndex: 2,
      daysAgo: 9,
    },
    {
      type: "reserved_instance",
      title: "Consider Reserved Instance for staging EC2",
      description: "While staging doesn't run 24/7, the consistent weekday usage pattern suggests a convertible Reserved Instance could still provide 15% savings over On-Demand pricing.",
      estimatedSavings: 25,
      status: "dismissed",
      accountIndex: 2,
      daysAgo: 18,
    },
  ];
}

interface SeedBudget {
  name: string;
  amount: number;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  alertThresholds: number[];
  accountIndex: number | null; // null means org-wide
}

function getSeedBudgets(): SeedBudget[] {
  return [
    {
      name: "Organization Monthly Budget",
      amount: 25000,
      period: "monthly",
      alertThresholds: [50, 80, 90, 100],
      accountIndex: null,
    },
    {
      name: "Production Monthly Budget",
      amount: 15000,
      period: "monthly",
      alertThresholds: [50, 80, 100],
      accountIndex: 0,
    },
    {
      name: "Development Monthly Budget",
      amount: 3000,
      period: "monthly",
      alertThresholds: [75, 100],
      accountIndex: 1,
    },
  ];
}

interface SeedAlert {
  type: "budget_exceeded" | "anomaly_detected" | "recommendation_available" | "cost_spike" | "resource_idle";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  daysAgo: number;
  acknowledged: boolean;
}

function getSeedAlerts(): SeedAlert[] {
  return [
    {
      type: "budget_exceeded",
      title: "Production budget at 85%",
      message: "The Production account has reached 85% of its $15,000 monthly budget with 8 days remaining in the billing period. Current spend: $12,750.",
      severity: "warning",
      daysAgo: 1,
      acknowledged: false,
    },
    {
      type: "cost_spike",
      title: "Unusual EC2 cost increase detected",
      message: "EC2 costs in us-east-1 increased by 35% compared to the 7-day average. This may be due to new instance launches or increased usage.",
      severity: "warning",
      daysAgo: 2,
      acknowledged: false,
    },
    {
      type: "recommendation_available",
      title: "New savings opportunity identified",
      message: "6 new cost optimization recommendations have been identified with total potential savings of $560/month. Review recommendations to start saving.",
      severity: "info",
      daysAgo: 2,
      acknowledged: false,
    },
    {
      type: "resource_idle",
      title: "Idle resources detected in Development",
      message: "2 EC2 instances in the Development account have shown no significant activity for over 14 days. Consider stopping or terminating these resources.",
      severity: "info",
      daysAgo: 3,
      acknowledged: true,
    },
    {
      type: "anomaly_detected",
      title: "S3 data transfer anomaly",
      message: "Data transfer out from S3 bucket 'acme-prod-assets' is 3x higher than the typical daily average. Investigate potential data exfiltration or misconfigured applications.",
      severity: "critical",
      daysAgo: 4,
      acknowledged: true,
    },
    {
      type: "budget_exceeded",
      title: "Organization budget at 50%",
      message: "The organization has reached 50% of its $25,000 monthly budget. You're on track to stay within budget this month.",
      severity: "info",
      daysAgo: 10,
      acknowledged: true,
    },
    {
      type: "cost_spike",
      title: "Lambda invocation spike",
      message: "Lambda function 'image-processor' had 500% more invocations than usual yesterday. This resulted in $45 in additional costs.",
      severity: "warning",
      daysAgo: 5,
      acknowledged: true,
    },
    {
      type: "recommendation_available",
      title: "Reserved Instance opportunity",
      message: "Based on your usage patterns, purchasing Reserved Instances for 3 RDS databases could save $4,680/year.",
      severity: "info",
      daysAgo: 12,
      acknowledged: true,
    },
  ];
}

interface SeedReport {
  type: "cost_analysis" | "savings_summary" | "resource_inventory" | "recommendation_summary" | "executive_summary";
  title: string;
  status: "pending" | "generating" | "completed" | "failed";
  daysAgo: number;
}

function getSeedReports(): SeedReport[] {
  return [
    {
      type: "cost_analysis",
      title: "Monthly Cost Analysis - January 2025",
      status: "completed",
      daysAgo: 5,
    },
    {
      type: "savings_summary",
      title: "Q4 2024 Savings Summary",
      status: "completed",
      daysAgo: 15,
    },
    {
      type: "executive_summary",
      title: "Weekly Executive Summary",
      status: "generating",
      daysAgo: 0,
    },
    {
      type: "resource_inventory",
      title: "Full Resource Inventory Report",
      status: "pending",
      daysAgo: 0,
    },
    {
      type: "recommendation_summary",
      title: "Cost Optimization Recommendations",
      status: "completed",
      daysAgo: 3,
    },
  ];
}

interface SeedActivityLog {
  action: "create" | "update" | "delete";
  entityType: "organization" | "aws_account" | "budget" | "report" | "invitation";
  description: string;
  daysAgo: number;
  userIndex: number;
}

function getSeedActivityLogs(): SeedActivityLog[] {
  return [
    {
      action: "create",
      entityType: "aws_account",
      description: "Connected AWS account 'Production' via IAM role",
      daysAgo: 25,
      userIndex: 0,
    },
    {
      action: "create",
      entityType: "aws_account",
      description: "Connected AWS account 'Development' via access keys",
      daysAgo: 24,
      userIndex: 0,
    },
    {
      action: "create",
      entityType: "aws_account",
      description: "Connected AWS account 'Staging' via IAM role",
      daysAgo: 23,
      userIndex: 1,
    },
    {
      action: "create",
      entityType: "budget",
      description: "Created organization-wide monthly budget of $25,000",
      daysAgo: 22,
      userIndex: 0,
    },
    {
      action: "create",
      entityType: "budget",
      description: "Created Production account budget of $15,000",
      daysAgo: 22,
      userIndex: 0,
    },
    {
      action: "update",
      entityType: "budget",
      description: "Updated Development budget alert thresholds",
      daysAgo: 15,
      userIndex: 1,
    },
    {
      action: "create",
      entityType: "invitation",
      description: "Invited alex.rivera@acme-demo.com to join organization",
      daysAgo: 20,
      userIndex: 0,
    },
    {
      action: "create",
      entityType: "report",
      description: "Generated Q4 2024 Savings Summary report",
      daysAgo: 15,
      userIndex: 1,
    },
    {
      action: "create",
      entityType: "report",
      description: "Generated Monthly Cost Analysis report",
      daysAgo: 5,
      userIndex: 0,
    },
    {
      action: "update",
      entityType: "aws_account",
      description: "Updated credentials for Development account",
      daysAgo: 10,
      userIndex: 1,
    },
    {
      action: "create",
      entityType: "aws_account",
      description: "Started connecting Legacy Infrastructure account",
      daysAgo: 3,
      userIndex: 2,
    },
    {
      action: "update",
      entityType: "organization",
      description: "Updated notification preferences",
      daysAgo: 8,
      userIndex: 0,
    },
  ];
}

// ============================================================================
// Seed Data Mutations
// ============================================================================

/**
 * Create a test admin user directly in the database.
 * Use this for development/testing when you need a quick admin user.
 * 
 * Usage: npx convex run seed:createTestAdminUser
 * Or with custom values: npx convex run seed:createTestAdminUser '{"email": "admin@test.com", "name": "Admin User"}'
 */
export const createTestAdminUser = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createOrganization: v.optional(v.boolean()),
    organizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email || "admin@test.com";
    const name = args.name || "Test Admin";
    const createOrg = args.createOrganization !== false; // Default to true
    const orgName = args.organizationName || "Test Organization";

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      return {
        success: false,
        message: `User with email "${email}" already exists`,
        userId: existingUser._id,
        user: existingUser,
      };
    }

    // Create the admin user
    const userId = await ctx.db.insert("users", {
      email,
      name,
      role: "admin",
      status: "active",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    let organizationId: Id<"organizations"> | null = null;

    // Optionally create an organization for the user
    if (createOrg) {
      const slug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      // Check if org with this slug exists
      const existingOrg = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existingOrg) {
        organizationId = await ctx.db.insert("organizations", {
          name: orgName,
          slug,
          plan: "professional",
          settings: {
            enableNotifications: true,
            maxUsers: 10,
          },
          createdAt: now,
          updatedAt: now,
        });

        // Add user as owner of the organization
        await ctx.db.insert("orgMembers", {
          organizationId,
          userId,
          role: "owner",
          createdAt: now,
          updatedAt: now,
        });
      } else {
        organizationId = existingOrg._id;
        // Check if user is already a member
        const existingMembership = await ctx.db
          .query("orgMembers")
          .withIndex("by_org_user", (q) => q.eq("organizationId", organizationId!).eq("userId", userId))
          .first();

        if (!existingMembership) {
          await ctx.db.insert("orgMembers", {
            organizationId,
            userId,
            role: "owner",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return {
      success: true,
      message: `Test admin user created successfully`,
      userId,
      organizationId,
      user: {
        email,
        name,
        role: "admin",
        status: "active",
      },
      credentials: {
        email,
        password: "(no password - use TEST_MODE=true or sign up via auth)",
      },
    };
  },
});

/**
 * Check if seed data already exists.
 */
export const hasSeedData = query({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", SEED_ORG_SLUG))
      .first();
    
    return org !== null;
  },
});

/**
 * Get the seed organization if it exists.
 * Useful for switching to the demo org in the UI.
 */
export const getSeedOrganization = query({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", SEED_ORG_SLUG))
      .first();
    
    return org;
  },
});

/**
 * Clear all seed data from the database.
 */
export const clearSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    // Find the seed organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", SEED_ORG_SLUG))
      .first();
    
    if (!org) {
      return { success: true, message: "No seed data found" };
    }
    
    await clearExistingSeedData(ctx, org._id);
    
    return { success: true, message: "Seed data cleared successfully" };
  },
});

/**
 * Seed data into an existing organization.
 * Use this to add demo data to your own organization.
 */
export const seedToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { organizationId } = args;
    const now = Date.now();
    
    // Verify organization exists
    const org = await ctx.db.get(organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }
    
    // Clear any existing seed data from this org (AWS accounts, costs, etc.)
    await clearOrgSeedData(ctx, organizationId);
    
    // Get existing users in the org for activity logs
    const existingMembers = await ctx.db
      .query("orgMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    
    const userIds = existingMembers.map((m) => m.userId);
    
    // Create AWS accounts
    const seedAccounts = getSeedAwsAccounts();
    const awsAccountIds: Id<"awsAccounts">[] = [];
    
    for (let i = 0; i < seedAccounts.length; i++) {
      const accountData = seedAccounts[i];
      const awsAccountId = await ctx.db.insert("awsAccounts", {
        organizationId,
        name: accountData.name,
        accountNumber: accountData.accountNumber,
        connectionType: accountData.connectionType,
        status: accountData.status,
        description: accountData.description,
        region: accountData.region,
        lastVerifiedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
        createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
      awsAccountIds.push(awsAccountId);
      
      // Create credentials for active accounts
      if (accountData.status === "active" || accountData.status === "pending") {
        if (accountData.connectionType === "iam_role") {
          await ctx.db.insert("awsCredentials", {
            awsAccountId,
            roleArn: `arn:aws:iam::${accountData.accountNumber}:role/AWSOptimizerRole`,
            externalId: `demo-${accountData.accountNumber}`,
            sessionDuration: 3600,
            validationStatus: accountData.status === "active" ? "healthy" : "unknown",
            lastValidatedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
            verifiedAccountNumber: accountData.status === "active" ? accountData.accountNumber : undefined,
            createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("awsCredentials", {
            awsAccountId,
            encryptedAccessKeyId: "ENCRYPTED_AKIAIOSFODNN7EXAMPLE",
            encryptedSecretAccessKey: "ENCRYPTED_wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            validationStatus: accountData.status === "active" ? "healthy" : "unknown",
            lastValidatedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
            verifiedAccountNumber: accountData.status === "active" ? accountData.accountNumber : undefined,
            createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
            updatedAt: now,
          });
        }
      }
    }
    
    // Create cost snapshots for active accounts
    const costMultipliers = [1.0, 0.3, 0.25, 0.15];
    
    for (let i = 0; i < awsAccountIds.length; i++) {
      const account = seedAccounts[i];
      if (account.status !== "active") continue;
      
      const snapshots = generateCostSnapshots(i, account.region, costMultipliers[i]);
      
      for (const snapshot of snapshots) {
        const snapshotDate = new Date(snapshot.date);
        await ctx.db.insert("costSnapshots", {
          awsAccountId: awsAccountIds[i],
          date: snapshot.date,
          totalCost: snapshot.totalCost,
          serviceBreakdown: snapshot.serviceBreakdown,
          regionBreakdown: snapshot.regionBreakdown,
          createdAt: snapshotDate.getTime(),
          updatedAt: snapshotDate.getTime(),
        });
      }
    }
    
    // Create resources
    const seedResources = getSeedResources();
    
    for (const resource of seedResources) {
      await ctx.db.insert("resources", {
        awsAccountId: awsAccountIds[resource.accountIndex],
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        name: resource.name,
        region: resource.region,
        tags: resource.tags,
        monthlyCost: resource.monthlyCost,
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    
    // Create recommendations
    const seedRecs = getSeedRecommendations();
    
    for (const rec of seedRecs) {
      const createdAt = now - rec.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("recommendations", {
        awsAccountId: awsAccountIds[rec.accountIndex],
        type: rec.type,
        title: rec.title,
        description: rec.description,
        estimatedSavings: rec.estimatedSavings,
        status: rec.status,
        createdAt,
        updatedAt: now,
      });
    }
    
    // Create budgets
    const seedBudgetsData = getSeedBudgets();
    
    for (const budget of seedBudgetsData) {
      await ctx.db.insert("budgets", {
        organizationId,
        awsAccountId: budget.accountIndex !== null ? awsAccountIds[budget.accountIndex] : undefined,
        name: budget.name,
        amount: budget.amount,
        period: budget.period,
        alertThresholds: budget.alertThresholds,
        createdAt: now - 22 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    
    // Create alerts
    const seedAlertsData = getSeedAlerts();
    
    for (const alert of seedAlertsData) {
      const triggeredAt = now - alert.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("alerts", {
        organizationId,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        triggeredAt,
        acknowledgedAt: alert.acknowledged ? triggeredAt + 2 * 60 * 60 * 1000 : undefined,
        createdAt: triggeredAt,
        updatedAt: now,
      });
    }
    
    // Create reports
    const seedReportsData = getSeedReports();
    
    for (const report of seedReportsData) {
      const createdAt = now - report.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("reports", {
        organizationId,
        type: report.type,
        title: report.title,
        status: report.status,
        generatedAt: report.status === "completed" ? createdAt + 5 * 60 * 1000 : undefined,
        createdAt,
        updatedAt: now,
      });
    }
    
    // Create activity logs (only if there are users)
    if (userIds.length > 0) {
      const seedLogsData = getSeedActivityLogs();
      
      for (const log of seedLogsData) {
        const createdAt = now - log.daysAgo * 24 * 60 * 60 * 1000;
        // Use modulo to cycle through available users
        const userId = userIds[log.userIndex % userIds.length];
        await ctx.db.insert("activityLogs", {
          organizationId,
          userId,
          action: log.action,
          entityType: log.entityType,
          entityId: `${log.entityType}-${createdAt}`,
          details: {
            description: log.description,
          },
          createdAt,
        });
      }
    }
    
    return {
      success: true,
      message: `Seed data added to organization "${org.name}"`,
      data: {
        organizationId,
        organizationName: org.name,
        awsAccountCount: awsAccountIds.length,
        costSnapshotCount: 30 * 3,
        resourceCount: seedResources.length,
        recommendationCount: seedRecs.length,
        budgetCount: seedBudgetsData.length,
        alertCount: seedAlertsData.length,
        reportCount: seedReportsData.length,
        activityLogCount: userIds.length > 0 ? getSeedActivityLogs().length : 0,
      },
    };
  },
});

/**
 * Seed the database with demo data.
 * This mutation is idempotent - it will clear existing seed data first.
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Check if seed data already exists and clear it
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", SEED_ORG_SLUG))
      .first();
    
    if (existingOrg) {
      // Clear existing seed data first (inline to avoid circular call)
      await clearExistingSeedData(ctx, existingOrg._id);
    }
    
    // Create organization
    const orgData = createSeedOrganizationData();
    const organizationId = await ctx.db.insert("organizations", {
      name: orgData.name,
      slug: orgData.slug,
      plan: orgData.plan,
      settings: orgData.settings,
      createdAt: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      updatedAt: now,
    });
    
    // Create users and org members
    const seedUsers = getSeedUsers();
    const userIds: Id<"users">[] = [];
    
    for (const userData of seedUsers) {
      const userId = await ctx.db.insert("users", {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: userData.status,
        emailVerified: userData.emailVerified,
        createdAt: now - 28 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
      userIds.push(userId);
      
      await ctx.db.insert("orgMembers", {
        organizationId,
        userId,
        role: userData.orgRole,
        createdAt: now - 28 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    
    // Create AWS accounts
    const seedAccounts = getSeedAwsAccounts();
    const awsAccountIds: Id<"awsAccounts">[] = [];
    
    for (let i = 0; i < seedAccounts.length; i++) {
      const accountData = seedAccounts[i];
      const awsAccountId = await ctx.db.insert("awsAccounts", {
        organizationId,
        name: accountData.name,
        accountNumber: accountData.accountNumber,
        connectionType: accountData.connectionType,
        status: accountData.status,
        description: accountData.description,
        region: accountData.region,
        lastVerifiedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
        createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
      awsAccountIds.push(awsAccountId);
      
      // Create credentials for active accounts
      if (accountData.status === "active" || accountData.status === "pending") {
        if (accountData.connectionType === "iam_role") {
          await ctx.db.insert("awsCredentials", {
            awsAccountId,
            roleArn: `arn:aws:iam::${accountData.accountNumber}:role/AWSOptimizerRole`,
            externalId: `acme-corp-${accountData.accountNumber}`,
            sessionDuration: 3600,
            validationStatus: accountData.status === "active" ? "healthy" : "unknown",
            lastValidatedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
            verifiedAccountNumber: accountData.status === "active" ? accountData.accountNumber : undefined,
            createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("awsCredentials", {
            awsAccountId,
            encryptedAccessKeyId: "ENCRYPTED_AKIAIOSFODNN7EXAMPLE",
            encryptedSecretAccessKey: "ENCRYPTED_wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            validationStatus: accountData.status === "active" ? "healthy" : "unknown",
            lastValidatedAt: accountData.status === "active" ? now - 2 * 60 * 60 * 1000 : undefined,
            verifiedAccountNumber: accountData.status === "active" ? accountData.accountNumber : undefined,
            createdAt: now - (25 - i) * 24 * 60 * 60 * 1000,
            updatedAt: now,
          });
        }
      }
    }
    
    // Create cost snapshots for active accounts
    const costMultipliers = [1.0, 0.3, 0.25, 0.15]; // Production has highest costs
    
    for (let i = 0; i < awsAccountIds.length; i++) {
      const account = seedAccounts[i];
      if (account.status !== "active") continue;
      
      const snapshots = generateCostSnapshots(i, account.region, costMultipliers[i]);
      
      for (const snapshot of snapshots) {
        const snapshotDate = new Date(snapshot.date);
        await ctx.db.insert("costSnapshots", {
          awsAccountId: awsAccountIds[i],
          date: snapshot.date,
          totalCost: snapshot.totalCost,
          serviceBreakdown: snapshot.serviceBreakdown,
          regionBreakdown: snapshot.regionBreakdown,
          createdAt: snapshotDate.getTime(),
          updatedAt: snapshotDate.getTime(),
        });
      }
    }
    
    // Create resources
    const seedResources = getSeedResources();
    
    for (const resource of seedResources) {
      await ctx.db.insert("resources", {
        awsAccountId: awsAccountIds[resource.accountIndex],
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        name: resource.name,
        region: resource.region,
        tags: resource.tags,
        monthlyCost: resource.monthlyCost,
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    
    // Create recommendations
    const seedRecs = getSeedRecommendations();
    
    for (const rec of seedRecs) {
      const createdAt = now - rec.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("recommendations", {
        awsAccountId: awsAccountIds[rec.accountIndex],
        type: rec.type,
        title: rec.title,
        description: rec.description,
        estimatedSavings: rec.estimatedSavings,
        status: rec.status,
        createdAt,
        updatedAt: now,
      });
    }
    
    // Create budgets
    const seedBudgetsData = getSeedBudgets();
    
    for (const budget of seedBudgetsData) {
      await ctx.db.insert("budgets", {
        organizationId,
        awsAccountId: budget.accountIndex !== null ? awsAccountIds[budget.accountIndex] : undefined,
        name: budget.name,
        amount: budget.amount,
        period: budget.period,
        alertThresholds: budget.alertThresholds,
        createdAt: now - 22 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    
    // Create alerts
    const seedAlertsData = getSeedAlerts();
    
    for (const alert of seedAlertsData) {
      const triggeredAt = now - alert.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("alerts", {
        organizationId,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        triggeredAt,
        acknowledgedAt: alert.acknowledged ? triggeredAt + 2 * 60 * 60 * 1000 : undefined,
        createdAt: triggeredAt,
        updatedAt: now,
      });
    }
    
    // Create reports
    const seedReportsData = getSeedReports();
    
    for (const report of seedReportsData) {
      const createdAt = now - report.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("reports", {
        organizationId,
        type: report.type,
        title: report.title,
        status: report.status,
        generatedAt: report.status === "completed" ? createdAt + 5 * 60 * 1000 : undefined,
        createdAt,
        updatedAt: now,
      });
    }
    
    // Create activity logs
    const seedLogsData = getSeedActivityLogs();
    
    for (const log of seedLogsData) {
      const createdAt = now - log.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("activityLogs", {
        organizationId,
        userId: userIds[log.userIndex],
        action: log.action,
        entityType: log.entityType,
        entityId: `${log.entityType}-${createdAt}`,
        details: {
          description: log.description,
        },
        createdAt,
      });
    }
    
    return {
      success: true,
      message: "Seed data created successfully",
      data: {
        organizationId,
        userCount: userIds.length,
        awsAccountCount: awsAccountIds.length,
        costSnapshotCount: 30 * 3, // 30 days * 3 active accounts
        resourceCount: seedResources.length,
        recommendationCount: seedRecs.length,
        budgetCount: seedBudgetsData.length,
        alertCount: seedAlertsData.length,
        reportCount: seedReportsData.length,
        activityLogCount: seedLogsData.length,
      },
    };
  },
});

// Helper function to clear seed data from an org without deleting the org itself
async function clearOrgSeedData(ctx: MutationCtx, orgId: Id<"organizations">) {
  // Delete activity logs
  const activityLogs = await ctx.db
    .query("activityLogs")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const log of activityLogs) {
    await ctx.db.delete(log._id);
  }
  
  // Delete reports
  const reports = await ctx.db
    .query("reports")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const report of reports) {
    await ctx.db.delete(report._id);
  }
  
  // Delete alerts
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const alert of alerts) {
    await ctx.db.delete(alert._id);
  }
  
  // Delete budgets
  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const budget of budgets) {
    await ctx.db.delete(budget._id);
  }
  
  // Get all AWS accounts for this org
  const awsAccounts = await ctx.db
    .query("awsAccounts")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  
  for (const account of awsAccounts) {
    // Delete recommendations
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const rec of recommendations) {
      await ctx.db.delete(rec._id);
    }
    
    // Delete resources
    const resources = await ctx.db
      .query("resources")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const resource of resources) {
      await ctx.db.delete(resource._id);
    }
    
    // Delete cost snapshots
    const snapshots = await ctx.db
      .query("costSnapshots")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }
    
    // Delete credentials
    const credentials = await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const cred of credentials) {
      await ctx.db.delete(cred._id);
    }
    
    // Delete the account
    await ctx.db.delete(account._id);
  }
}

// Helper function to clear existing seed data (used internally)
async function clearExistingSeedData(ctx: MutationCtx, orgId: Id<"organizations">) {
  // Delete activity logs
  const activityLogs = await ctx.db
    .query("activityLogs")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const log of activityLogs) {
    await ctx.db.delete(log._id);
  }
  
  // Delete reports
  const reports = await ctx.db
    .query("reports")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const report of reports) {
    await ctx.db.delete(report._id);
  }
  
  // Delete alerts
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const alert of alerts) {
    await ctx.db.delete(alert._id);
  }
  
  // Delete budgets
  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  for (const budget of budgets) {
    await ctx.db.delete(budget._id);
  }
  
  // Get all AWS accounts for this org
  const awsAccounts = await ctx.db
    .query("awsAccounts")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  
  for (const account of awsAccounts) {
    // Delete recommendations
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const rec of recommendations) {
      await ctx.db.delete(rec._id);
    }
    
    // Delete resources
    const resources = await ctx.db
      .query("resources")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const resource of resources) {
      await ctx.db.delete(resource._id);
    }
    
    // Delete cost snapshots
    const snapshots = await ctx.db
      .query("costSnapshots")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }
    
    // Delete credentials
    const credentials = await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    for (const cred of credentials) {
      await ctx.db.delete(cred._id);
    }
    
    // Delete the account
    await ctx.db.delete(account._id);
  }
  
  // Delete org members
  const members = await ctx.db
    .query("orgMembers")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  
  const userIds: Id<"users">[] = [];
  for (const member of members) {
    userIds.push(member.userId);
    await ctx.db.delete(member._id);
  }
  
  // Delete users
  for (const userId of userIds) {
    const user = await ctx.db.get(userId);
    if (user && user.email.endsWith("@acme-demo.com")) {
      await ctx.db.delete(userId);
    }
  }
  
  // Delete the organization
  await ctx.db.delete(orgId);
}
