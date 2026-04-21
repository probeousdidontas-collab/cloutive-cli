/**
 * Cost Analysis Report Orchestrator
 *
 * Coordinates the full report generation pipeline:
 * 1. Fetch cost data from AWS Cost Explorer (direct)
 * 2. Generate AI insights
 * 3. Save structured report data
 *
 * Progress is reported at each step for real-time UI updates.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const generateCostAnalysisReport = internalAction({
  args: {
    reportId: v.id("reports"),
    organizationId: v.id("organizations"),
    reportTitle: v.string(),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
    trendMonths: v.optional(v.number()),
    topAccountCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { reportId, organizationId, awsAccountIds } = args;
    const trendMonths = args.trendMonths ?? 6;
    const topAccountCount = args.topAccountCount ?? 15;

    console.log(`[CostAnalysis] Starting report generation for ${reportId}`);

    try {
      // Step 1: Initialize
      await ctx.runMutation(internal.ai.reportGeneration.updateReportStatusGenerating, { reportId });

      // Step 2: Fetch AWS accounts
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 2,
        progressMessage: "Fetching AWS accounts...",
        progressPercent: 10,
      });

      const accounts = await ctx.runQuery(internal.ai.reportGeneration.getAwsAccountsForOrg, {
        organizationId,
        awsAccountIds,
      });

      if (!accounts || accounts.length === 0) {
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: "[NO_ACCOUNTS] No active AWS accounts found | Suggestion: Connect at least one AWS account before generating reports.",
        });
        return;
      }

      // Step 3: Fetch cost data
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 3,
        progressMessage: `Collecting cost data for ${accounts.length} account(s)...`,
        progressPercent: 20,
      });

      let reportData;
      try {
        reportData = await ctx.runAction(internal.ai.costAnalysisData.fetchCostAnalysisData, {
          organizationId,
          awsAccountIds,
          trendMonths,
          topAccountCount,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
          reportId,
          errorMessage: `[AWS_ACCESS] Failed to fetch cost data | Details: ${message} | Suggestion: Verify AWS credentials and Cost Explorer permissions.`,
        });
        return;
      }

      // Step 4: Service breakdown progress
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 5,
        progressMessage: "Cost data collected. Analyzing service breakdowns...",
        progressPercent: 60,
      });

      // Step 5: Generate AI insights
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 6,
        progressMessage: "Generating AI insights...",
        progressPercent: 75,
      });

      let enrichedDataJson: string;
      try {
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
          enrichedDataJson = await ctx.runAction(internal.ai.costAnalysisInsights.generateInsights, {
            reportDataJson: JSON.stringify(reportData),
          });
        } else {
          console.log("[CostAnalysis] Skipping AI insights - Bedrock credentials not configured");
          enrichedDataJson = JSON.stringify(reportData);
        }
      } catch (error) {
        console.error("[CostAnalysis] AI insights failed, continuing without:", error);
        enrichedDataJson = JSON.stringify(reportData);
      }

      // Step 6: Save report
      await ctx.runMutation(internal.ai.reportGeneration.updateReportProgress, {
        reportId,
        progressStep: 7,
        progressMessage: "Saving report...",
        progressPercent: 90,
      });

      await ctx.runMutation(internal.ai.reportGeneration.updateReportCompletedWithData, {
        reportId,
        reportData: enrichedDataJson,
      });

      console.log(`[CostAnalysis] Report ${reportId} completed successfully`);

    } catch (error) {
      console.error(`[CostAnalysis] Unexpected error:`, error);
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.ai.reportGeneration.updateReportFailed, {
        reportId,
        errorMessage: `[UNKNOWN] Report generation failed | Details: ${message} | Suggestion: Please try again.`,
      });
    }
  },
});
