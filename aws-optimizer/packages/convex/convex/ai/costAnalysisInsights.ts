/**
 * AI Insights Generator for Cost Analysis Reports
 *
 * Takes structured cost data and generates:
 * - Executive insights paragraph (organization-level)
 * - Per-account commentary (for accounts with significant cost changes)
 *
 * Uses Amazon Bedrock (Claude Opus 4.6) for text generation.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText } from "ai";
import type { CostAnalysisReportData } from "./costAnalysisTypes";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || "eu-central-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const MODEL_ID = "global.anthropic.claude-opus-4-6-v1";

/**
 * Generate executive insights and per-account AI commentary.
 * Takes reportData as JSON string, enriches it with AI insights, returns enriched JSON string.
 */
export const generateInsights = internalAction({
  args: {
    reportDataJson: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const reportData: CostAnalysisReportData = JSON.parse(args.reportDataJson);

    const summaryText = buildSummaryForAI(reportData);

    // Resolve prompt from DB
    const dbPrompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
      type: "cost_analysis_insights",
    });

    const roleDefinition = dbPrompt?.sections.find((s: { key: string }) => s.key === "role_definition")?.value
      ?? "You are an AWS cost optimization expert.";
    const execInstructions = dbPrompt?.sections.find((s: { key: string }) => s.key === "executive_summary_instructions")?.value
      ?? "Based on the following AWS cost data, write a concise executive insights paragraph (3-5 sentences). Focus on: key cost drivers, notable trends, and urgent areas needing attention. Be specific with numbers. Do NOT use markdown formatting - plain text only.";
    const accountRules = dbPrompt?.sections.find((s: { key: string }) => s.key === "account_commentary_rules")?.value
      ?? "Based on the following account cost data, write 1-2 sentences of insight about what's driving costs and any recommended actions. Be specific. Plain text only, no markdown.";

    // Generate executive insights
    const executiveResult = await generateText({
      model: bedrock(MODEL_ID),
      prompt: `${roleDefinition}. ${execInstructions}\n\n${summaryText}`,
      maxOutputTokens: 500,
    });

    reportData.executiveInsights = executiveResult.text;

    // Generate per-account insights for accounts with significant changes (>10% or >$100)
    for (const account of reportData.accountDetails) {
      const absChange = Math.abs(account.change);
      const absPercent = Math.abs(
        account.previousMonth > 0
          ? (account.change / account.previousMonth) * 100
          : 0
      );

      if (absChange > 100 || absPercent > 10) {
        const accountSummary = buildAccountSummaryForAI(account);

        const accountResult = await generateText({
          model: bedrock(MODEL_ID),
          prompt: `${roleDefinition}. ${accountRules}\n\n${accountSummary}`,
          maxOutputTokens: 200,
        });

        account.aiInsights = accountResult.text;
      }
    }

    return JSON.stringify(reportData);
  },
});

function buildSummaryForAI(data: CostAnalysisReportData): string {
  const lines: string[] = [
    `Organization: ${data.organizationName} (${data.accountCount} accounts)`,
    `Period: ${data.comparisonMonths[0]} vs ${data.comparisonMonths[1]}`,
    `Total: $${data.summary.currentMonth.total.toLocaleString()} (${data.summary.changePercent > 0 ? "+" : ""}${data.summary.changePercent}% MoM)`,
    ``,
    `Top accounts by cost:`,
  ];

  for (const acc of data.topAccounts.slice(0, 10)) {
    lines.push(
      `  ${acc.name}: $${acc.currentMonth.toLocaleString()} (${acc.changePercent > 0 ? "+" : ""}${acc.changePercent}%)`
    );
  }

  const accountsWithIncreases = data.accountDetails.filter(
    (a) => a.change > 0 && a.rootCauseAnalysis.length > 0
  );
  if (accountsWithIncreases.length > 0) {
    lines.push(``, `Key cost increases:`);
    for (const acc of accountsWithIncreases.slice(0, 5)) {
      for (const rca of acc.rootCauseAnalysis.slice(0, 2)) {
        lines.push(
          `  ${acc.name} / ${rca.serviceName}: +$${rca.change} (${rca.usageTypes.map((u) => u.name).join(", ")})`
        );
      }
    }
  }

  return lines.join("\n");
}

function buildAccountSummaryForAI(
  account: CostAnalysisReportData["accountDetails"][0]
): string {
  const lines: string[] = [
    `Account: ${account.name} (${account.accountId})`,
    `Current: $${account.currentMonth.toLocaleString()}, Previous: $${account.previousMonth.toLocaleString()}, Change: ${account.change > 0 ? "+" : ""}$${account.change}`,
    `Top services:`,
  ];

  for (const svc of account.topServices.slice(0, 5)) {
    const costs = Object.entries(svc.costs)
      .map(([m, c]) => `${m}: $${c}`)
      .join(", ");
    lines.push(`  ${svc.name}: ${costs}`);
  }

  if (account.rootCauseAnalysis.length > 0) {
    lines.push(`Cost increases:`);
    for (const rca of account.rootCauseAnalysis) {
      lines.push(
        `  ${rca.serviceName}: $${rca.previousCost} -> $${rca.currentCost} (+$${rca.change})`
      );
      for (const ut of rca.usageTypes) {
        lines.push(
          `    ${ut.name}: $${ut.previousCost} -> $${ut.currentCost} (+$${ut.change})`
        );
      }
    }
  }

  return lines.join("\n");
}
