/**
 * AWS Command Tools for AI Agent
 *
 * Implements US-015: Implement AI agent AWS command tools
 *
 * These tools are called by the AI agent autonomously to:
 * - Execute AWS CLI commands via sandbox
 * - Query Cost Explorer data
 * - Inventory AWS resources (EC2, RDS, S3)
 * - Retrieve Reserved Instance and Savings Plan data
 *
 * All tools call sandbox.executeCommand action internally.
 */

import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

// Tool context type - matches @convex-dev/agent tool context
interface ToolContext {
  ctx: ActionCtx;
  userId?: string;
  threadId?: string;
  messageId?: string;
}

// Sandbox execution result type
interface SandboxExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

// ============================================================================
// aws_executeCommand Tool
// ============================================================================

/**
 * Execute an arbitrary AWS CLI command.
 *
 * This is the low-level tool for running any AWS CLI command.
 * Use specialized tools (getCostData, listResources, etc.) when possible
 * for better structured output.
 */
export const aws_executeCommand = Object.assign(
  async function aws_executeCommand(
    { ctx }: ToolContext,
    args: { awsAccountId: string; command: string }
  ): Promise<SandboxExecuteResult> {
    const result = await ctx.runAction(internal.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command: args.command,
    });
    return result;
  },
  {
    description:
      "Execute an AWS CLI command in the sandbox environment. Use this for any AWS CLI command. The command must start with 'aws '. Returns stdout, stderr, exitCode, and execution time.",
    args: {
      awsAccountId: v.string(),
      command: v.string(),
    },
  }
);

// ============================================================================
// aws_getCostData Tool
// ============================================================================

/**
 * Get cost and usage data from AWS Cost Explorer.
 *
 * Builds and executes an `aws ce get-cost-and-usage` command
 * with the specified parameters.
 */
export const aws_getCostData = Object.assign(
  async function aws_getCostData(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      startDate: string;
      endDate: string;
      granularity?: string;
      groupBy?: string;
    }
  ): Promise<SandboxExecuteResult> {
    const granularity = args.granularity || "DAILY";
    const groupByClause = args.groupBy
      ? `--group-by Type=DIMENSION,Key=${args.groupBy}`
      : "";

    const command = `aws ce get-cost-and-usage --time-period Start=${args.startDate},End=${args.endDate} --granularity ${granularity} --metrics BlendedCost UnblendedCost UsageQuantity ${groupByClause}`.trim();

    const result = await ctx.runAction(internal.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command,
    });
    return result;
  },
  {
    description:
      "Query AWS Cost Explorer for cost and usage data. Returns cost breakdown by service, region, or other dimensions. Use this for cost analysis, trend identification, and spending reports.",
    args: {
      awsAccountId: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      granularity: v.optional(v.string()),
      groupBy: v.optional(v.string()),
    },
  }
);

// ============================================================================
// aws_listResources Tool
// ============================================================================

/**
 * List AWS resources of a specific type.
 *
 * Supports EC2 instances, RDS databases, S3 buckets, Lambda functions,
 * EBS volumes, and more.
 */
export const aws_listResources = Object.assign(
  async function aws_listResources(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      resourceType: string;
      region?: string;
    }
  ): Promise<SandboxExecuteResult> {
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

    const result = await ctx.runAction(internal.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command: command.trim(),
    });
    return result;
  },
  {
    description:
      "List AWS resources of a specific type. Supported types: ec2, rds, s3, lambda, ebs, elb, elasticache, dynamodb, ecs, eks. Use this for resource inventory, utilization analysis, and discovering unused resources.",
    args: {
      awsAccountId: v.string(),
      resourceType: v.string(),
      region: v.optional(v.string()),
    },
  }
);

// ============================================================================
// aws_getReservations Tool
// ============================================================================

/**
 * Get Reserved Instance and Savings Plan data.
 *
 * Retrieves information about RIs, Savings Plans, and their utilization.
 */
export const aws_getReservations = Object.assign(
  async function aws_getReservations(
    { ctx }: ToolContext,
    args: {
      awsAccountId: string;
      reservationType?: string;
    }
  ): Promise<SandboxExecuteResult> {
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
        // Compute dates in JavaScript for cross-platform compatibility
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        command = `aws ce get-reservation-utilization --time-period Start=${thirtyDaysAgo},End=${today} --granularity MONTHLY`;
        break;
    }

    const result = await ctx.runAction(internal.sandbox.executeCommand, {
      awsAccountId: args.awsAccountId as Id<"awsAccounts">,
      command,
    });
    return result;
  },
  {
    description:
      "Get Reserved Instance and Savings Plan data. Supported types: ec2, rds, elasticache, redshift, savings_plans, all. Use this for analyzing reservation coverage, utilization, and identifying savings opportunities.",
    args: {
      awsAccountId: v.string(),
      reservationType: v.optional(v.string()),
    },
  }
);

// ============================================================================
// Export all tools
// ============================================================================

/**
 * All AWS command tools bundled for use with the AI agent.
 */
export const AWS_COMMAND_TOOLS = {
  aws_executeCommand,
  aws_getCostData,
  aws_listResources,
  aws_getReservations,
};
