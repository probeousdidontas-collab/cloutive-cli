/**
 * Report Generation Action
 *
 * This action orchestrates report generation using the AI agent with sandbox tools.
 * When a report is created, this action is scheduled to:
 * 1. Update report status to "generating"
 * 2. Fetch AWS accounts to analyze
 * 3. Build a prompt based on report type
 * 4. Run the AI agent with tools to gather data and generate content
 * 5. Save the generated markdown content
 * 6. Update status to "completed" (or "failed" on error)
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { awsCostAgent } from "./awsCostAgent";

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Error types for report generation failures.
 * These help the UI display actionable error messages.
 */
type ErrorCategory = 
  | "configuration" // Missing API keys, env vars
  | "authentication" // Auth/permission issues
  | "no_accounts" // No AWS accounts connected
  | "aws_access" // AWS API/credential issues
  | "ai_agent" // AI model/generation errors
  | "timeout" // Request took too long
  | "unknown"; // Unclassified errors

interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  details?: string;
  suggestion?: string;
}

/**
 * Classify an error and provide a user-friendly message with suggestions.
 */
function classifyError(error: unknown): ClassifiedError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();

  // Check for API key / configuration errors
  if (
    errorString.includes("api key") ||
    errorString.includes("apikey") ||
    errorString.includes("unauthorized") ||
    errorString.includes("authentication") ||
    errorString.includes("invalid_api_key") ||
    errorString.includes("accessdenied") ||
    errorString.includes("access denied") ||
    errorString.includes("bedrock")
  ) {
    return {
      category: "configuration",
      message: "AI service not configured",
      details:
        "Amazon Bedrock credentials are missing, invalid, or lack InvokeModel permission.",
      suggestion:
        "Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION in Convex env and enable the Claude model in the Bedrock console.",
    };
  }

  // Check for rate limiting
  if (
    errorString.includes("rate limit") ||
    errorString.includes("too many requests") ||
    errorString.includes("429")
  ) {
    return {
      category: "ai_agent",
      message: "AI service rate limited",
      details: "Too many requests to the AI service. Please wait a moment.",
      suggestion: "Wait a few minutes and try again. Consider upgrading your OpenRouter plan if this persists.",
    };
  }

  // Check for timeout errors
  if (
    errorString.includes("timeout") ||
    errorString.includes("timed out") ||
    errorString.includes("deadline")
  ) {
    return {
      category: "timeout",
      message: "Report generation timed out",
      details: "The AI agent took too long to analyze your AWS accounts.",
      suggestion: "Try generating a report with fewer AWS accounts, or choose a simpler report type like 'Executive Summary'.",
    };
  }

  // Check for AWS credential/access errors
  if (
    errorString.includes("aws") &&
    (errorString.includes("credential") ||
      errorString.includes("access denied") ||
      errorString.includes("not authorized"))
  ) {
    return {
      category: "aws_access",
      message: "AWS access error",
      details: "Unable to access AWS resources with the provided credentials.",
      suggestion: "Verify your AWS account connections and ensure the IAM role has the necessary permissions.",
    };
  }

  // Check for model errors
  if (
    errorString.includes("model") ||
    errorString.includes("anthropic") ||
    errorString.includes("claude") ||
    errorString.includes("context length") ||
    errorString.includes("max tokens")
  ) {
    return {
      category: "ai_agent",
      message: "AI model error",
      details: errorMessage,
      suggestion: "Try generating a simpler report or reducing the number of AWS accounts to analyze.",
    };
  }

  // Check for network errors
  if (
    errorString.includes("network") ||
    errorString.includes("connection") ||
    errorString.includes("fetch failed") ||
    errorString.includes("econnrefused")
  ) {
    return {
      category: "ai_agent",
      message: "Network connection error",
      details: "Unable to connect to the AI service.",
      suggestion: "Check your internet connection and try again. If the problem persists, the AI service may be temporarily unavailable.",
    };
  }

  // Default unknown error
  return {
    category: "unknown",
    message: "Report generation failed",
    details: errorMessage,
    suggestion: "Please try again. If the problem persists, contact support with the error details.",
  };
}

/**
 * Format a classified error into a storable error message.
 */
function formatErrorMessage(classified: ClassifiedError): string {
  const parts = [
    `[${classified.category.toUpperCase()}] ${classified.message}`,
  ];
  
  if (classified.details) {
    parts.push(`Details: ${classified.details}`);
  }
  
  if (classified.suggestion) {
    parts.push(`Suggestion: ${classified.suggestion}`);
  }
  
  return parts.join(" | ");
}

// ============================================================================
// Internal Mutations for Report Status Updates
// ============================================================================

/**
 * Update report status to generating.
 */
export const updateReportStatusGenerating = internalMutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "generating",
      progressStep: 1,
      progressMessage: "Initializing report generation...",
      progressPercent: 5,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update report progress.
 */
export const updateReportProgress = internalMutation({
  args: {
    reportId: v.id("reports"),
    progressStep: v.number(),
    progressMessage: v.string(),
    progressPercent: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      progressStep: args.progressStep,
      progressMessage: args.progressMessage,
      progressPercent: args.progressPercent,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update report with generated content.
 */
export const updateReportCompleted = internalMutation({
  args: {
    reportId: v.id("reports"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: "completed",
      content: args.content,
      progressStep: 5,
      progressMessage: "Report completed!",
      progressPercent: 100,
      generatedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update report with structured JSON report data.
 */
export const updateReportCompletedWithData = internalMutation({
  args: {
    reportId: v.id("reports"),
    reportData: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: "completed",
      reportData: args.reportData,
      progressStep: 8,
      progressMessage: "Report completed!",
      progressPercent: 100,
      generatedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update report status to failed with error message.
 */
export const updateReportFailed = internalMutation({
  args: {
    reportId: v.id("reports"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "failed",
      errorMessage: args.errorMessage,
      progressMessage: "Report generation failed",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal query to get AWS accounts for the organization.
 */
export const getAwsAccountsForOrg = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
  },
  handler: async (ctx, args) => {
    if (args.awsAccountIds && args.awsAccountIds.length > 0) {
      // Get specific accounts
      const accounts = [];
      for (const id of args.awsAccountIds) {
        const account = await ctx.db.get(id);
        if (account && account.organizationId === args.organizationId && account.status === "active") {
          accounts.push(account);
        }
      }
      return accounts;
    }

    // Get all active accounts for the organization
    return await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

// ============================================================================
// Report Prompt Builders
// ============================================================================

type ReportType = "cost_analysis" | "savings_summary" | "resource_inventory" | "recommendation_summary" | "executive_summary";

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  region?: string;
}

/**
 * Build the prompt for the AI agent based on report type.
 * Kept as fallback when no DB prompt is found.
 */
function legacyBuildReportPrompt(
  reportType: ReportType,
  reportTitle: string,
  organizationId: string,
  accounts: AwsAccount[]
): string {
  const accountList = accounts
    .map((a) => `- ${a.name} (${a.accountNumber})${a.region ? ` - Region: ${a.region}` : ""}`)
    .join("\n");

  const baseContext = `
You are generating a report titled: "${reportTitle}"
Organization ID: ${organizationId}

AWS Accounts to analyze:
${accountList}

**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly

`;

  switch (reportType) {
    case "cost_analysis":
      return `${baseContext}
**Report Type: Cost Analysis**

Generate a comprehensive cost analysis report that includes:

1. **Executive Summary** - High-level cost overview
2. **Cost Breakdown by Service** - Top spending services with percentages
3. **Cost Breakdown by Region** - Geographic cost distribution
4. **Cost Trends** - Daily/weekly/monthly trends (use aws_getCostData with different date ranges)
5. **Cost Anomalies** - Any unusual spending patterns detected
6. **Month-over-Month Comparison** - How costs compare to previous periods

Use the aws_getCostData tool with appropriate date ranges (last 30 days, last 7 days, etc.) to gather this information.

Format the report in clean markdown with tables for data and clear section headers.`;

    case "savings_summary":
      return `${baseContext}
**Report Type: Savings Summary**

Generate a savings opportunity report that includes:

1. **Executive Summary** - Total potential savings identified
2. **Reserved Instance Opportunities** - RI recommendations using aws_getReservations
3. **Savings Plan Opportunities** - SP recommendations
4. **Rightsizing Recommendations** - Instances that could be downsized (use aws_listResources for ec2)
5. **Unused Resources** - Resources with low or no utilization
6. **Quick Wins** - Easy-to-implement savings (< 1 hour effort)
7. **Implementation Roadmap** - Prioritized list of actions

Use aws_getReservations, aws_listResources (for ec2, rds, ebs), and aws_getCostData to gather this information.
Use the recommendation_save tool to persist each recommendation found.

Format with clear estimated savings amounts and implementation effort levels.`;

    case "resource_inventory":
      return `${baseContext}
**Report Type: Resource Inventory**

Generate a comprehensive resource inventory report that includes:

1. **Executive Summary** - Total resource counts by type
2. **EC2 Instances** - All instances with details (use aws_listResources with resourceType: ec2)
3. **RDS Databases** - All databases with configurations
4. **S3 Buckets** - All buckets with size estimates
5. **Lambda Functions** - All functions with memory/timeout configs
6. **Load Balancers** - ELB/ALB inventory
7. **Storage Volumes** - EBS volumes with utilization
8. **Resource Tags Analysis** - Tag coverage and consistency

For each resource found, use the analysis_saveResource tool to persist it to the inventory.

Format with detailed tables showing resource attributes, estimated costs, and tags.`;

    case "recommendation_summary":
      return `${baseContext}
**Report Type: Recommendation Summary**

Generate a prioritized recommendations report that includes:

1. **Executive Summary** - Total recommendations and potential savings
2. **Critical Recommendations** - High-impact, urgent items
3. **High Priority** - Significant savings opportunities
4. **Medium Priority** - Moderate effort/savings tradeoff
5. **Low Priority** - Nice-to-have optimizations
6. **Implementation Timeline** - Suggested order of implementation
7. **Risk Assessment** - Potential risks for each recommendation

Analyze costs, resources, and reservations to identify recommendations.
Use the recommendation_save tool to persist each recommendation found.

Include estimated savings, effort level, and risk for each recommendation.`;

    case "executive_summary":
      return `${baseContext}
**Report Type: Executive Summary**

Generate a concise executive summary report suitable for leadership that includes:

1. **Key Metrics Dashboard**
   - Total monthly spend
   - Month-over-month change
   - Total potential savings identified
   - RI/SP coverage percentage

2. **Top 3 Cost Drivers** - Biggest spending areas

3. **Top 3 Savings Opportunities** - Quick wins with highest ROI

4. **Trend Analysis** - Cost trajectory and predictions

5. **Action Items** - Prioritized list of recommended next steps

6. **Risk Alerts** - Any concerning patterns or issues

Keep this report concise (1-2 pages equivalent) with visual elements where helpful.
Focus on business impact and actionable insights.`;

    default:
      return `${baseContext}
Generate a general AWS cost analysis report with cost breakdown, resource inventory, and optimization recommendations.`;
  }
}

// ============================================================================
// Report Generation Action
// ============================================================================

/**
 * Generate a report using the AI agent.
 * This action is scheduled after a report record is created.
 */
export const generateReport = internalAction({
  args: {
    reportId: v.id("reports"),
    organizationId: v.id("organizations"),
    reportType: v.union(
      v.literal("cost_analysis"),
      v.literal("savings_summary"),
      v.literal("resource_inventory"),
      v.literal("recommendation_summary"),
      v.literal("executive_summary")
    ),
    reportTitle: v.string(),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
  },
  handler: async (ctx, args) => {
    const { reportId, organizationId, reportType, reportTitle, awsAccountIds } = args;

    console.log(`[ReportGeneration] Starting report generation for report ${reportId}, type: ${reportType}`);

    try {
      // Pre-flight check: Verify Bedrock credentials are configured
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error("[ReportGeneration] Bedrock credentials not configured");
        const classified = classifyError(
          new Error("Bedrock credentials missing: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY")
        );
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: formatErrorMessage(classified),
        });
        return;
      }

      // Step 1: Update status to generating
      console.log(`[ReportGeneration] Step 1: Updating status to generating`);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportStatusGenerating, {
        reportId,
      });

      // Step 2: Fetch AWS accounts
      console.log(`[ReportGeneration] Step 2: Fetching AWS accounts for organization ${organizationId}`);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 2,
        progressMessage: "Fetching AWS accounts...",
        progressPercent: 15,
      });

      const accounts = await ctx.runQuery(internal.ai.reportGeneration.getAwsAccountsForOrg, {
        organizationId,
        awsAccountIds,
      });

      console.log(`[ReportGeneration] Found ${accounts?.length || 0} AWS accounts`);

      if (!accounts || accounts.length === 0) {
        const classified: ClassifiedError = {
          category: "no_accounts",
          message: "No AWS accounts available",
          details: "No active AWS accounts found for this organization.",
          suggestion: "Connect at least one AWS account in the AWS Accounts page before generating reports.",
        };
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: formatErrorMessage(classified),
        });
        return;
      }

      // Step 3: Building analysis prompt
      console.log(`[ReportGeneration] Step 3: Building analysis prompt for ${accounts.length} account(s)`);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 3,
        progressMessage: `Preparing analysis for ${accounts.length} AWS account${accounts.length > 1 ? "s" : ""}...`,
        progressPercent: 25,
      });

      // Try to resolve prompt from DB, fall back to hardcoded
      const dbPrompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
        type: reportType,
        organizationId: organizationId as Id<"organizations">,
      });

      let prompt: string;
      if (dbPrompt) {
        const sectionTexts = dbPrompt.sections.map((s: { value: string }) => s.value).join("\n\n");
        const suffix = dbPrompt.freeformSuffix ? `\n\n${dbPrompt.freeformSuffix}` : "";
        const accountList = (accounts as AwsAccount[])
          .map((a) => `- ${a.name} (${a.accountNumber})${a.region ? ` - Region: ${a.region}` : ""}`)
          .join("\n");
        prompt = `You are generating a report titled: "${reportTitle}"\nOrganization ID: ${organizationId}\n\nAWS Accounts to analyze:\n${accountList}\n\n${sectionTexts}${suffix}`;
      } else {
        prompt = legacyBuildReportPrompt(reportType, reportTitle, organizationId, accounts as AwsAccount[]);
      }

      // Step 4: Running AI agent analysis
      console.log(`[ReportGeneration] Step 4: Starting AI agent analysis`);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 4,
        progressMessage: "AI agent analyzing AWS data and generating report...",
        progressPercent: 40,
      });

      let result;
      try {
        console.log(`[ReportGeneration] Creating AI agent thread...`);
        const { thread } = await awsCostAgent.createThread(ctx, {});
        
        console.log(`[ReportGeneration] Running AI agent generateText...`);
        result = await thread.generateText(ctx, {
          prompt,
        });
        console.log(`[ReportGeneration] AI agent completed successfully`);
      } catch (aiError) {
        console.error(`[ReportGeneration] AI agent error:`, aiError);
        const classified = classifyError(aiError);
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: formatErrorMessage(classified),
        });
        return;
      }

      // Update progress after AI completes
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 4,
        progressMessage: "Finalizing report content...",
        progressPercent: 90,
      });

      const content = result.text;

      if (!content || content.trim().length === 0) {
        console.error(`[ReportGeneration] AI agent returned empty content`);
        const classified: ClassifiedError = {
          category: "ai_agent",
          message: "Empty report generated",
          details: "The AI agent did not generate any content.",
          suggestion: "Try again with a different report type or fewer AWS accounts.",
        };
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: formatErrorMessage(classified),
        });
        return;
      }

      console.log(`[ReportGeneration] Generated content length: ${content.length} characters`);

      // Step 5: Update report with generated content
      console.log(`[ReportGeneration] Step 5: Saving completed report`);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportCompleted, {
        reportId,
        content,
      });

      console.log(`[ReportGeneration] Report ${reportId} completed successfully`);

    } catch (error) {
      // Handle unexpected errors
      console.error(`[ReportGeneration] Unexpected error:`, error);
      const classified = classifyError(error);
      
      await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
        reportId,
        errorMessage: formatErrorMessage(classified),
      });
    }
  },
});
