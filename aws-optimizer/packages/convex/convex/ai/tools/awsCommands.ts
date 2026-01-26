/**
 * AWS Command Tools for AI Agent
 *
 * Implements US-015: Implement AI agent AWS command tools
 *
 * These tools are called by the AI agent autonomously to:
 * - List connected AWS accounts
 * - Execute AWS CLI commands via sandbox
 * - Query Cost Explorer data
 * - Inventory AWS resources (EC2, RDS, S3)
 * - Retrieve Reserved Instance and Savings Plan data
 *
 * All tools call sandbox.executeCommand action internally.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { Id } from "../../_generated/dataModel";
import { api } from "../../_generated/api";

// ============================================================================
// aws_listAccounts Tool
// ============================================================================

/**
 * List all available AWS accounts for the current organization.
 */
export const aws_listAccounts = createTool({
  description:
    "List all connected AWS accounts for the organization. Returns account IDs, names, account numbers, and status. Use this first to discover which accounts are available before running AWS commands.",
  args: z.object({
    organizationId: z.string().describe("The organization ID to list accounts for"),
  }),
  handler: async (ctx, args) => {
    const accounts = await ctx.runQuery(api.awsAccounts.listByOrganization, {
      organizationId: args.organizationId as Id<"organizations">,
    });

    const accountList = (accounts || []).map((acc: {
      _id: Id<"awsAccounts">;
      name: string;
      accountNumber: string;
      status: string;
      connectionType: string;
      region?: string;
    }) => ({
      id: acc._id,
      name: acc.name,
      accountNumber: acc.accountNumber,
      status: acc.status,
      connectionType: acc.connectionType,
      region: acc.region,
    }));

    return {
      success: true,
      accounts: accountList,
      message: accountList.length > 0
        ? `Found ${accountList.length} AWS account(s): ${accountList.map((a: { name: string }) => a.name).join(", ")}`
        : "No AWS accounts connected. Please connect an account first.",
    };
  },
});

// ============================================================================
// aws_executeCommand Tool
// ============================================================================

/**
 * Execute an arbitrary AWS CLI command.
 */
export const aws_executeCommand = createTool({
  description:
    "Execute an AWS CLI command in the sandbox environment. Use this for any AWS CLI command. The command must start with 'aws '. Returns stdout, stderr, exitCode, and execution time.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID to run the command against"),
    command: z.string().describe("The AWS CLI command to execute (must start with 'aws ')"),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runAction(api.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command: args.command,
    });
    return result;
  },
});

// ============================================================================
// aws_getCostData Tool
// ============================================================================

/**
 * Get cost and usage data from AWS Cost Explorer.
 */
export const aws_getCostData = createTool({
  description:
    "Query AWS Cost Explorer for cost and usage data. Returns cost breakdown by service, region, or other dimensions. Use this for cost analysis, trend identification, and spending reports.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID to query costs for"),
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
    granularity: z.string().optional().describe("DAILY or MONTHLY (default: DAILY)"),
    groupBy: z.string().optional().describe("Dimension to group by: SERVICE, REGION, LINKED_ACCOUNT, etc."),
  }),
  handler: async (ctx, args) => {
    const granularity = args.granularity || "DAILY";
    const groupByClause = args.groupBy
      ? `--group-by Type=DIMENSION,Key=${args.groupBy}`
      : "";

    const command = `aws ce get-cost-and-usage --time-period Start=${args.startDate},End=${args.endDate} --granularity ${granularity} --metrics BlendedCost UnblendedCost UsageQuantity ${groupByClause}`.trim();

    const result = await ctx.runAction(api.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command,
    });
    return result;
  },
});

// ============================================================================
// aws_listResources Tool
// ============================================================================

/**
 * List AWS resources of a specific type.
 */
export const aws_listResources = createTool({
  description:
    "List AWS resources of a specific type. Supported types: ec2, rds, s3, lambda, ebs, elb, elasticache, dynamodb, ecs, eks. Use this for resource inventory, utilization analysis, and discovering unused resources.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID to list resources from"),
    resourceType: z.string().describe("Type of resource: ec2, rds, s3, lambda, ebs, elb, elasticache, dynamodb, ecs, eks"),
    region: z.string().optional().describe("AWS region (e.g., us-east-1). Required for regional services."),
  }),
  handler: async (ctx, args) => {
    const regionFlag = args.region ? `--region ${args.region}` : "";

    // Map resource types to AWS CLI commands
    const resourceCommands: Record<string, string> = {
      ec2: `aws ec2 describe-instances ${regionFlag}`,
      rds: `aws rds describe-db-instances ${regionFlag}`,
      s3: `aws s3api list-buckets`,
      lambda: `aws lambda list-functions ${regionFlag}`,
      ebs: `aws ec2 describe-volumes ${regionFlag}`,
      elb: `aws elbv2 describe-load-balancers ${regionFlag}`,
      elasticache: `aws elasticache describe-cache-clusters ${regionFlag}`,
      dynamodb: `aws dynamodb list-tables ${regionFlag}`,
      ecs: `aws ecs list-clusters ${regionFlag}`,
      eks: `aws eks list-clusters ${regionFlag}`,
    };

    const resourceTypeLower = args.resourceType.toLowerCase();
    const command =
      resourceCommands[resourceTypeLower] ||
      `aws ${resourceTypeLower} describe-${resourceTypeLower}s ${regionFlag}`.trim();

    const result = await ctx.runAction(api.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command: command.trim(),
    });
    return result;
  },
});

// ============================================================================
// aws_getReservations Tool
// ============================================================================

/**
 * Get Reserved Instance and Savings Plan data.
 */
export const aws_getReservations = createTool({
  description:
    "Get Reserved Instance and Savings Plan data. Supported types: ec2, rds, elasticache, redshift, savings_plans, all. Use this for analyzing reservation coverage, utilization, and identifying savings opportunities.",
  args: z.object({
    awsAccountId: z.string().describe("The AWS account ID to query reservations for"),
    reservationType: z.string().optional().describe("Type of reservation: ec2, rds, elasticache, redshift, savings_plans, all (default: all)"),
  }),
  handler: async (ctx, args) => {
    const reservationType = args.reservationType || "all";

    // Build command based on reservation type
    let command: string;

    switch (reservationType.toLowerCase()) {
      case "ec2":
        command = "aws ec2 describe-reserved-instances";
        break;
      case "rds":
        command = "aws rds describe-reserved-db-instances";
        break;
      case "elasticache":
        command = "aws elasticache describe-reserved-cache-nodes";
        break;
      case "redshift":
        command = "aws redshift describe-reserved-nodes";
        break;
      case "savings_plans":
      case "savingsplans":
        command = "aws savingsplans describe-savings-plans";
        break;
      case "all":
      default:
        // Get a summary using Cost Explorer reservation utilization
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        command = `aws ce get-reservation-utilization --time-period Start=${thirtyDaysAgo},End=${today} --granularity MONTHLY`;
        break;
    }

    const result = await ctx.runAction(api.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command,
    });
    return result;
  },
});

// ============================================================================
// Export all tools
// ============================================================================

/**
 * All AWS command tools bundled for use with the AI agent.
 */
export const AWS_COMMAND_TOOLS = {
  aws_listAccounts,
  aws_executeCommand,
  aws_getCostData,
  aws_listResources,
  aws_getReservations,
};
