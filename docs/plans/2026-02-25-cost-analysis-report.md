# Organization Cost Analysis Report - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a structured, visually rich Organization Cost Analysis PDF report with executive summaries, per-account breakdowns, trend charts, and AI-powered root cause analysis — matching the style of a professional AWS cost analysis report.

**Architecture:** Hybrid approach — direct AWS Cost Explorer API calls for accurate cost data (tables, charts), AI agent for executive insights and root cause commentary. Data stored as structured JSON in `reportData` field. React-PDF renders a designed template with SVG charts.

**Tech Stack:** Convex (backend/actions), AWS Cost Explorer CLI, OpenRouter/Claude Sonnet 4 (AI insights), React-PDF with SVG primitives (PDF rendering), Mantine (frontend UI)

---

### Task 1: Add `reportData` field to schema

**Files:**
- Modify: `aws-optimizer/packages/convex/convex/schema.ts:593-629`

**Step 1: Add the reportData field**

In the `reports` table definition, add an optional `reportData` field after the `content` field (line ~603):

```typescript
    // Generated content (markdown format) - used by AI-generated reports
    content: v.optional(v.string()),

    // Structured report data (JSON) - used by cost analysis reports
    reportData: v.optional(v.string()),
```

**Step 2: Run Convex dev to validate schema**

Run: `cd aws-optimizer/packages/convex && npx convex dev --once`
Expected: Schema pushes successfully, no errors

**Step 3: Commit**

```bash
git add aws-optimizer/packages/convex/convex/schema.ts
git commit -m "feat(reports): add reportData field to reports schema for structured cost analysis data"
```

---

### Task 2: Create the CostAnalysisReportData TypeScript interface

**Files:**
- Create: `aws-optimizer/packages/convex/convex/ai/costAnalysisTypes.ts`

**Step 1: Write the shared type definitions**

```typescript
/**
 * Type definitions for Organization Cost Analysis Report data.
 *
 * This structured JSON format is used by:
 * - The backend action to populate report data from AWS Cost Explorer
 * - The frontend PDF template to render the report
 */

export interface CostAnalysisReportData {
  // Metadata
  organizationName: string;
  accountCount: number;
  dateRange: { start: string; end: string };
  generatedAt: string;
  trendMonths: number;
  comparisonMonths: string[]; // e.g. ["September 2025", "October 2025"]

  // Executive Summary
  summary: {
    currentMonth: { name: string; total: number };
    previousMonth: { name: string; total: number };
    change: number;
    changePercent: number;
  };

  // AI-generated executive insights
  executiveInsights?: string;

  // Top N Accounts ranked by current month cost
  topAccounts: AccountSummary[];

  // Organization monthly trends (for stacked bar chart)
  organizationTrends: MonthlyTrend[];

  // Per-account detail pages
  accountDetails: AccountDetail[];
}

export interface AccountSummary {
  name: string;
  accountId: string;
  previousMonth: number;
  currentMonth: number;
  change: number;
  changePercent: number;
}

export interface MonthlyTrend {
  month: string; // e.g. "May", "Jun"
  accounts: Record<string, number>; // accountName -> cost
  total: number;
}

export interface AccountDetail {
  name: string;
  accountId: string;
  currentMonth: number;
  previousMonth: number;
  change: number;
  serviceCount: number;

  // Monthly trend (line chart data)
  monthlyTrend: Array<{ month: string; cost: number }>;

  // Root cause analysis - top cost-increasing services
  rootCauseAnalysis: RootCauseService[];

  // AI commentary for this account
  aiInsights?: string;

  // Top 10 services (last 3 months)
  topServices: ServiceCost[];
}

export interface RootCauseService {
  serviceName: string;
  previousCost: number;
  currentCost: number;
  change: number;
  usageTypes: UsageTypeCost[];
}

export interface UsageTypeCost {
  name: string;
  previousCost: number;
  currentCost: number;
  change: number;
}

export interface ServiceCost {
  name: string;
  costs: Record<string, number>; // monthName -> cost
}
```

**Step 2: Commit**

```bash
git add aws-optimizer/packages/convex/convex/ai/costAnalysisTypes.ts
git commit -m "feat(reports): add CostAnalysisReportData type definitions"
```

---

### Task 3: Create cost data fetching action

**Files:**
- Create: `aws-optimizer/packages/convex/convex/ai/costAnalysisData.ts`

This action fetches raw cost data from AWS Cost Explorer via the sandbox. It does NOT use the AI agent — it makes direct AWS CLI calls.

**Step 1: Write the cost data fetcher**

```typescript
/**
 * Cost Analysis Data Fetcher
 *
 * Fetches cost data directly from AWS Cost Explorer via sandbox execution.
 * This action handles the "data" part of the hybrid approach:
 * - Monthly cost totals per account (N months)
 * - Service breakdown per account (last 3 months)
 * - Usage type breakdown for top cost-increasing services (last 2 months)
 *
 * All AWS CLI commands are executed through the sandbox worker.
 */

import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type {
  CostAnalysisReportData,
  AccountSummary,
  AccountDetail,
  MonthlyTrend,
  RootCauseService,
  ServiceCost,
} from "./costAnalysisTypes";

/**
 * Get organization name by ID.
 */
export const getOrganizationName = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    return org?.name ?? "Unknown Organization";
  },
});

/**
 * Execute an AWS CLI command through the sandbox for a given account.
 */
async function executeAwsCommand(
  ctx: any,
  awsAccountId: Id<"awsAccounts">,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await ctx.runAction(api.sandbox.executeCommand, {
    awsAccountId,
    command,
  });
}

/**
 * Parse Cost Explorer JSON response into a simple month->cost map.
 * Handles both grouped and ungrouped responses.
 */
function parseCostExplorerResponse(
  stdout: string,
  groupKey?: string
): Record<string, Record<string, number>> {
  // Returns: { "2025-10": { "Amazon EC2": 500, "Amazon S3": 150 } }
  try {
    const data = JSON.parse(stdout);
    const result: Record<string, Record<string, number>> = {};

    for (const period of data.ResultsByTime || []) {
      const monthKey = period.TimePeriod.Start.substring(0, 7); // "2025-10"

      if (period.Groups && period.Groups.length > 0) {
        result[monthKey] = {};
        for (const group of period.Groups) {
          const key = group.Keys[0];
          const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || group.Metrics?.BlendedCost?.Amount || "0");
          if (cost > 0.005) { // Filter out near-zero costs
            result[monthKey][key] = Math.round(cost * 100) / 100;
          }
        }
      } else {
        const cost = parseFloat(period.Total?.UnblendedCost?.Amount || period.Total?.BlendedCost?.Amount || "0");
        result[monthKey] = { total: Math.round(cost * 100) / 100 };
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Format a YYYY-MM key into a short month name like "May" or "Jun".
 */
function formatMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

/**
 * Format a YYYY-MM key into a full month name like "September 2025".
 */
function formatMonthFull(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Calculate date range: N months back from today.
 * Returns { start: "YYYY-MM-01", end: "YYYY-MM-01" } where end is first day of NEXT month.
 */
function getDateRange(trendMonths: number): { start: string; end: string } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = new Date(now.getFullYear(), now.getMonth() - trendMonths + 1, 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

  return { start: fmt(startDate), end: fmt(endDate) };
}

/**
 * Main action: Fetch all cost data for an organization and build structured report data.
 */
export const fetchCostAnalysisData = internalAction({
  args: {
    organizationId: v.id("organizations"),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
    trendMonths: v.optional(v.number()), // default 6
    topAccountCount: v.optional(v.number()), // default 15
  },
  handler: async (ctx, args): Promise<CostAnalysisReportData> => {
    const trendMonths = args.trendMonths ?? 6;
    const topAccountCount = args.topAccountCount ?? 15;
    const dateRange = getDateRange(trendMonths);

    // 1. Get organization name
    const orgName = await ctx.runQuery(internal.ai.costAnalysisData.getOrganizationName, {
      organizationId: args.organizationId,
    });

    // 2. Get AWS accounts
    const accounts = await ctx.runQuery(internal.ai.reportGeneration.getAwsAccountsForOrg, {
      organizationId: args.organizationId,
      awsAccountIds: args.awsAccountIds,
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No active AWS accounts found for this organization");
    }

    // 3. Fetch monthly costs per account
    // Use the first account (management account or any active account) for org-level CE queries
    const primaryAccountId = accounts[0]._id;

    // --- STEP A: Monthly totals grouped by linked account ---
    const monthlyByAccountCmd = `aws ce get-cost-and-usage --time-period Start=${dateRange.start},End=${dateRange.end} --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=LINKED_ACCOUNT --filter '{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}'`;

    const monthlyResult = await executeAwsCommand(ctx, primaryAccountId, monthlyByAccountCmd);
    const monthlyByAccount = parseCostExplorerResponse(monthlyResult.stdout);

    // Build account number -> name mapping
    const accountNumberToName: Record<string, string> = {};
    const accountNumberToId: Record<string, string> = {};
    for (const acc of accounts) {
      accountNumberToName[acc.accountNumber] = acc.name;
      accountNumberToId[acc.accountNumber] = acc.accountNumber;
    }

    // Get sorted month keys
    const allMonths = Object.keys(monthlyByAccount).sort();
    const currentMonthKey = allMonths[allMonths.length - 1];
    const previousMonthKey = allMonths.length >= 2 ? allMonths[allMonths.length - 2] : undefined;

    // Calculate per-account totals for current and previous month
    const accountTotals: AccountSummary[] = [];
    const allAccountNumbers = new Set<string>();
    for (const monthData of Object.values(monthlyByAccount)) {
      for (const accNum of Object.keys(monthData)) {
        allAccountNumbers.add(accNum);
      }
    }

    for (const accNum of allAccountNumbers) {
      const name = accountNumberToName[accNum] || accNum;
      const currentCost = monthlyByAccount[currentMonthKey]?.[accNum] || 0;
      const prevCost = previousMonthKey ? (monthlyByAccount[previousMonthKey]?.[accNum] || 0) : 0;
      const change = currentCost - prevCost;
      const changePercent = prevCost > 0 ? (change / prevCost) * 100 : (currentCost > 0 ? 100 : 0);

      accountTotals.push({
        name,
        accountId: accNum,
        currentMonth: Math.round(currentCost),
        previousMonth: Math.round(prevCost),
        change: Math.round(change),
        changePercent: Math.round(changePercent * 10) / 10,
      });
    }

    // Sort by current month cost descending
    accountTotals.sort((a, b) => b.currentMonth - a.currentMonth);
    const topAccounts = accountTotals.slice(0, topAccountCount);

    // Organization totals
    const currentTotal = accountTotals.reduce((sum, a) => sum + a.currentMonth, 0);
    const previousTotal = accountTotals.reduce((sum, a) => sum + a.previousMonth, 0);
    const totalChange = currentTotal - previousTotal;
    const totalChangePercent = previousTotal > 0 ? (totalChange / previousTotal) * 100 : 0;

    // Organization trends (for stacked bar chart)
    const organizationTrends: MonthlyTrend[] = allMonths.map((monthKey) => {
      const monthAccounts: Record<string, number> = {};
      let total = 0;
      const monthData = monthlyByAccount[monthKey] || {};

      // Only include top accounts in trends chart
      for (const acc of topAccounts.slice(0, 10)) {
        const cost = Math.round(monthData[acc.accountId] || 0);
        if (cost > 0) {
          monthAccounts[acc.name] = cost;
          total += cost;
        }
      }

      return {
        month: formatMonthShort(monthKey),
        accounts: monthAccounts,
        total,
      };
    });

    // --- STEP B: Per-account service breakdown (last 3 months) ---
    const serviceBreakdownMonths = allMonths.slice(-3);
    const serviceStartDate = serviceBreakdownMonths[0] + "-01";

    const accountDetails: AccountDetail[] = [];

    // Process top accounts for detail pages (accounts above $100/month)
    const detailAccounts = accountTotals.filter(
      (a) => a.currentMonth >= 100 || a.previousMonth >= 100
    );

    for (const acc of detailAccounts) {
      // Find the matching awsAccount record
      const awsAccount = accounts.find((a) => a.accountNumber === acc.accountId);
      if (!awsAccount) continue;

      // Fetch service breakdown for this account
      const serviceCmd = `aws ce get-cost-and-usage --time-period Start=${serviceStartDate},End=${dateRange.end} --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE --filter '{"And":[{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["${acc.accountId}"]}},{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}]}'`;

      const serviceResult = await executeAwsCommand(ctx, primaryAccountId, serviceCmd);
      const serviceData = parseCostExplorerResponse(serviceResult.stdout);

      // Build top 10 services table
      const serviceMap = new Map<string, Record<string, number>>();
      for (const [monthKey, services] of Object.entries(serviceData)) {
        for (const [svc, cost] of Object.entries(services)) {
          if (!serviceMap.has(svc)) serviceMap.set(svc, {});
          serviceMap.get(svc)![formatMonthShort(monthKey)] = Math.round(cost);
        }
      }

      // Sort services by most recent month cost
      const lastMonthShort = formatMonthShort(serviceBreakdownMonths[serviceBreakdownMonths.length - 1]);
      const topServices: ServiceCost[] = Array.from(serviceMap.entries())
        .sort((a, b) => (b[1][lastMonthShort] || 0) - (a[1][lastMonthShort] || 0))
        .slice(0, 10)
        .map(([name, costs]) => ({ name, costs }));

      // Root cause analysis: find top 3 services with biggest cost increase
      const rootCauseServices: RootCauseService[] = [];
      if (serviceBreakdownMonths.length >= 2) {
        const prevSvcMonth = serviceBreakdownMonths[serviceBreakdownMonths.length - 2];
        const currSvcMonth = serviceBreakdownMonths[serviceBreakdownMonths.length - 1];
        const prevServices = serviceData[prevSvcMonth] || {};
        const currServices = serviceData[currSvcMonth] || {};

        const svcChanges: Array<{ name: string; prev: number; curr: number; change: number }> = [];
        const allSvcs = new Set([...Object.keys(prevServices), ...Object.keys(currServices)]);
        for (const svc of allSvcs) {
          const prev = prevServices[svc] || 0;
          const curr = currServices[svc] || 0;
          const change = curr - prev;
          if (change > 1) {
            svcChanges.push({ name: svc, prev, curr, change });
          }
        }
        svcChanges.sort((a, b) => b.change - a.change);

        // For top 3 increasing services, fetch usage type breakdown
        for (const svcChange of svcChanges.slice(0, 3)) {
          const usageCmd = `aws ce get-cost-and-usage --time-period Start=${prevSvcMonth}-01,End=${dateRange.end} --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE --filter '{"And":[{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["${acc.accountId}"]}},{"Dimensions":{"Key":"SERVICE","Values":["${svcChange.name}"]}},{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}]}'`;

          const usageResult = await executeAwsCommand(ctx, primaryAccountId, usageCmd);
          const usageData = parseCostExplorerResponse(usageResult.stdout);

          const prevUsages = usageData[prevSvcMonth] || {};
          const currUsages = usageData[currSvcMonth] || {};

          const usageTypes = Object.keys({ ...prevUsages, ...currUsages })
            .map((ut) => ({
              name: ut,
              previousCost: Math.round(prevUsages[ut] || 0),
              currentCost: Math.round(currUsages[ut] || 0),
              change: Math.round((currUsages[ut] || 0) - (prevUsages[ut] || 0)),
            }))
            .filter((ut) => ut.change > 0)
            .sort((a, b) => b.change - a.change)
            .slice(0, 3);

          rootCauseServices.push({
            serviceName: svcChange.name,
            previousCost: Math.round(svcChange.prev),
            currentCost: Math.round(svcChange.curr),
            change: Math.round(svcChange.change),
            usageTypes,
          });
        }
      }

      // Monthly trend for this account
      const monthlyTrend = allMonths.map((monthKey) => ({
        month: formatMonthShort(monthKey),
        cost: Math.round(monthlyByAccount[monthKey]?.[acc.accountId] || 0),
      }));

      accountDetails.push({
        name: acc.name,
        accountId: acc.accountId,
        currentMonth: acc.currentMonth,
        previousMonth: acc.previousMonth,
        change: acc.change,
        serviceCount: topServices.length,
        monthlyTrend,
        rootCauseAnalysis: rootCauseServices,
        topServices,
      });
    }

    return {
      organizationName: orgName,
      accountCount: accounts.length,
      dateRange,
      generatedAt: new Date().toISOString(),
      trendMonths,
      comparisonMonths: [
        previousMonthKey ? formatMonthFull(previousMonthKey) : "",
        formatMonthFull(currentMonthKey),
      ],
      summary: {
        currentMonth: { name: formatMonthFull(currentMonthKey), total: currentTotal },
        previousMonth: { name: previousMonthKey ? formatMonthFull(previousMonthKey) : "", total: previousTotal },
        change: totalChange,
        changePercent: Math.round(totalChangePercent * 10) / 10,
      },
      topAccounts,
      organizationTrends,
      accountDetails,
    };
  },
});
```

**Step 2: Commit**

```bash
git add aws-optimizer/packages/convex/convex/ai/costAnalysisData.ts
git commit -m "feat(reports): add cost analysis data fetcher using AWS Cost Explorer"
```

---

### Task 4: Create AI insights generation action

**Files:**
- Create: `aws-optimizer/packages/convex/convex/ai/costAnalysisInsights.ts`

This action takes the structured cost data and asks the AI agent for executive insights and per-account commentary.

**Step 1: Write the AI insights action**

```typescript
/**
 * AI Insights Generator for Cost Analysis Reports
 *
 * Takes structured cost data and generates:
 * - Executive insights paragraph (organization-level)
 * - Per-account commentary (for accounts with significant cost changes)
 *
 * Uses the existing awsCostAgent but with a focused prompt.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import type { CostAnalysisReportData } from "./costAnalysisTypes";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL_ID = "anthropic/claude-sonnet-4";

/**
 * Generate executive insights and per-account AI commentary.
 * Mutates the reportData in-place by adding executiveInsights and aiInsights fields.
 */
export const generateInsights = internalAction({
  args: {
    reportDataJson: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const reportData: CostAnalysisReportData = JSON.parse(args.reportDataJson);

    // Build a concise data summary for the AI
    const summaryText = buildSummaryForAI(reportData);

    // Generate executive insights
    const executiveResult = await generateText({
      model: openrouter(MODEL_ID),
      prompt: `You are an AWS cost optimization expert. Based on the following AWS cost data, write a concise executive insights paragraph (3-5 sentences). Focus on: key cost drivers, notable trends, and urgent areas needing attention. Be specific with numbers. Do NOT use markdown formatting - plain text only.

${summaryText}`,
      maxTokens: 500,
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
          model: openrouter(MODEL_ID),
          prompt: `You are an AWS cost optimization expert. Based on the following account cost data, write 1-2 sentences of insight about what's driving costs and any recommended actions. Be specific. Plain text only, no markdown.

${accountSummary}`,
          maxTokens: 200,
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

  // Add root cause highlights
  const accountsWithIncreases = data.accountDetails.filter((a) => a.change > 0 && a.rootCauseAnalysis.length > 0);
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

function buildAccountSummaryForAI(account: CostAnalysisReportData["accountDetails"][0]): string {
  const lines: string[] = [
    `Account: ${account.name} (${account.accountId})`,
    `Current: $${account.currentMonth.toLocaleString()}, Previous: $${account.previousMonth.toLocaleString()}, Change: ${account.change > 0 ? "+" : ""}$${account.change}`,
    `Top services:`,
  ];

  for (const svc of account.topServices.slice(0, 5)) {
    const costs = Object.entries(svc.costs).map(([m, c]) => `${m}: $${c}`).join(", ");
    lines.push(`  ${svc.name}: ${costs}`);
  }

  if (account.rootCauseAnalysis.length > 0) {
    lines.push(`Cost increases:`);
    for (const rca of account.rootCauseAnalysis) {
      lines.push(`  ${rca.serviceName}: $${rca.previousCost} -> $${rca.currentCost} (+$${rca.change})`);
      for (const ut of rca.usageTypes) {
        lines.push(`    ${ut.name}: $${ut.previousCost} -> $${ut.currentCost} (+$${ut.change})`);
      }
    }
  }

  return lines.join("\n");
}
```

**Step 2: Commit**

```bash
git add aws-optimizer/packages/convex/convex/ai/costAnalysisInsights.ts
git commit -m "feat(reports): add AI insights generator for cost analysis reports"
```

---

### Task 5: Create the report orchestration action

**Files:**
- Create: `aws-optimizer/packages/convex/convex/ai/costAnalysisReport.ts`
- Modify: `aws-optimizer/packages/convex/convex/ai/reportGeneration.ts` (add new progress mutation for saving reportData)

**Step 1: Add `updateReportCompletedWithData` mutation to `reportGeneration.ts`**

Add this after the existing `updateReportCompleted` mutation (around line 231):

```typescript
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
```

**Step 2: Write the orchestration action**

Create `aws-optimizer/packages/convex/convex/ai/costAnalysisReport.ts`:

```typescript
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
        if (process.env.OPENROUTER_API_KEY) {
          enrichedDataJson = await ctx.runAction(internal.ai.costAnalysisInsights.generateInsights, {
            reportDataJson: JSON.stringify(reportData),
          });
        } else {
          // Skip AI if no key configured — report still works without insights
          console.log("[CostAnalysis] Skipping AI insights — OPENROUTER_API_KEY not configured");
          enrichedDataJson = JSON.stringify(reportData);
        }
      } catch (error) {
        // AI insights are optional — continue without them
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
```

**Step 3: Commit**

```bash
git add aws-optimizer/packages/convex/convex/ai/costAnalysisReport.ts aws-optimizer/packages/convex/convex/ai/reportGeneration.ts
git commit -m "feat(reports): add cost analysis report orchestration action"
```

---

### Task 6: Add `generateCostAnalysis` mutation to reports.ts

**Files:**
- Modify: `aws-optimizer/packages/convex/convex/reports.ts`

**Step 1: Add the new mutation**

Add this after the existing `generate` mutation (after line ~212):

```typescript
/**
 * Generate a new Cost Analysis report.
 * This uses the structured data pipeline (not AI markdown).
 */
export const generateCostAnalysis = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
    trendMonths: v.optional(v.number()),
    topAccountCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let organizationId: Id<"organizations"> | null = args.organizationId ?? null;

    if (!organizationId && !isTestMode()) {
      organizationId = await getUserOrgId(ctx);
    }

    if (!organizationId && isTestMode()) {
      const firstOrg = await ctx.db.query("organizations").first();
      organizationId = firstOrg?._id ?? null;
    }

    if (!organizationId) {
      throw new Error("No organization found. Please create an organization first.");
    }

    const now = Date.now();

    const reportId = await ctx.db.insert("reports", {
      organizationId,
      type: "cost_analysis",
      title: args.name,
      status: "pending",
      awsAccountIds: args.awsAccountIds,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.ai.costAnalysisReport.generateCostAnalysisReport, {
      reportId,
      organizationId,
      reportTitle: args.name,
      awsAccountIds: args.awsAccountIds,
      trendMonths: args.trendMonths,
      topAccountCount: args.topAccountCount,
    });

    return { reportId };
  },
});
```

**Step 2: Add `reportData` to the `get` query response**

In the existing `get` query handler (around line 110), add `reportData` to the returned object:

```typescript
      reportData: report.reportData,
```

Add it after the `content` line. Also update the `list` query to include `hasReportData`:

In the `list` query's `map` function (around line 88), add:

```typescript
      hasReportData: !!report.reportData,
```

**Step 3: Commit**

```bash
git add aws-optimizer/packages/convex/convex/reports.ts
git commit -m "feat(reports): add generateCostAnalysis mutation with date range params"
```

---

### Task 7: Create PDF primitive components

**Files:**
- Create: `aws-optimizer/apps/web/src/components/pdf/SummaryCard.tsx`
- Create: `aws-optimizer/apps/web/src/components/pdf/DataTable.tsx`
- Create: `aws-optimizer/apps/web/src/components/pdf/RootCauseBlock.tsx`

**Step 1: Create the `pdf` directory**

Run: `mkdir -p aws-optimizer/apps/web/src/components/pdf`

**Step 2: Write SummaryCard component**

`aws-optimizer/apps/web/src/components/pdf/SummaryCard.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    minWidth: 120,
  },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    marginTop: 2,
  },
});

interface SummaryCardProps {
  label: string;
  value: string;
  subtitle?: string;
  bgColor: string;
  textColor?: string;
}

export function SummaryCard({ label, value, subtitle, bgColor, textColor = "#ffffff" }: SummaryCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <Text style={[styles.label, { color: textColor, opacity: 0.8 }]}>{label}</Text>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: textColor, opacity: 0.7 }]}>{subtitle}</Text>
      )}
    </View>
  );
}
```

**Step 3: Write DataTable component**

`aws-optimizer/apps/web/src/components/pdf/DataTable.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  table: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cell: {
    padding: 6,
    fontSize: 8,
    color: "#374151",
  },
  headerCell: {
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e293b",
  },
});

interface Column {
  key: string;
  label: string;
  width?: number; // flex width, default 1
  align?: "left" | "right" | "center";
  render?: (value: any, row: any) => string;
  color?: (value: any, row: any) => string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
}

export function DataTable({ columns, data }: DataTableProps) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[
              styles.headerCell,
              { flex: col.width ?? 1, textAlign: col.align ?? "left" },
            ]}
          >
            {col.label}
          </Text>
        ))}
      </View>

      {/* Rows */}
      {data.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[styles.row, rowIndex % 2 === 1 ? { backgroundColor: "#fafbfc" } : {}]}
        >
          {columns.map((col) => {
            const rawValue = row[col.key];
            const displayValue = col.render ? col.render(rawValue, row) : String(rawValue ?? "");
            const textColor = col.color ? col.color(rawValue, row) : "#374151";

            return (
              <Text
                key={col.key}
                style={[
                  styles.cell,
                  {
                    flex: col.width ?? 1,
                    textAlign: col.align ?? "left",
                    color: textColor,
                    fontWeight: col.key === "name" || col.key === "account" ? "bold" : "normal",
                  },
                ]}
              >
                {displayValue}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}
```

**Step 4: Write RootCauseBlock component**

`aws-optimizer/apps/web/src/components/pdf/RootCauseBlock.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { RootCauseService } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  serviceBlock: {
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    padding: 8,
    borderRadius: 4,
  },
  serviceName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 2,
  },
  costChange: {
    fontSize: 8,
    color: "#374151",
    marginBottom: 4,
  },
  usageType: {
    marginLeft: 8,
    marginBottom: 2,
    borderLeftWidth: 2,
    borderLeftColor: "#fca5a5",
    paddingLeft: 6,
  },
  usageTypeName: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
  },
  usageTypeCost: {
    fontSize: 7,
    color: "#6b7280",
  },
});

interface RootCauseBlockProps {
  services: RootCauseService[];
}

export function RootCauseBlock({ services }: RootCauseBlockProps) {
  if (services.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Root Cause Analysis - Top Cost Increases</Text>
      {services.map((svc, i) => (
        <View key={i} style={styles.serviceBlock}>
          <Text style={styles.serviceName}>{svc.serviceName}</Text>
          <Text style={styles.costChange}>
            Cost Change: ${svc.previousCost.toLocaleString()} → ${svc.currentCost.toLocaleString()} (+${svc.change.toLocaleString()})
          </Text>
          {svc.usageTypes.map((ut, j) => (
            <View key={j} style={styles.usageType}>
              <Text style={styles.usageTypeName}>{ut.name}</Text>
              <Text style={styles.usageTypeCost}>
                Cost: ${ut.previousCost.toLocaleString()} → ${ut.currentCost.toLocaleString()} (+${ut.change.toLocaleString()})
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
```

**Step 5: Commit**

```bash
git add aws-optimizer/apps/web/src/components/pdf/
git commit -m "feat(reports): add PDF primitive components (SummaryCard, DataTable, RootCauseBlock)"
```

---

### Task 8: Create PDF chart components (SVG)

**Files:**
- Create: `aws-optimizer/apps/web/src/components/pdf/LineChart.tsx`
- Create: `aws-optimizer/apps/web/src/components/pdf/StackedBarChart.tsx`

**Step 1: Write LineChart component**

`aws-optimizer/apps/web/src/components/pdf/LineChart.tsx`:

```tsx
import React from "react";
import { View, StyleSheet, Svg, Line, Circle, Text as SvgText, Rect } from "@react-pdf/renderer";
import { Text } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: "#fafbfc",
    borderRadius: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
});

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  title?: string;
  width?: number;
  height?: number;
  color?: string;
}

export function LineChart({
  data,
  title,
  width = 450,
  height = 150,
  color = "#6366f1",
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = 0;
  const valueRange = maxValue - minValue || 1;

  const getX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minValue) / valueRange) * chartHeight;

  // Build polyline points
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(" ");

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minValue + (valueRange * (4 - i)) / 4;
    return { value: Math.round(val), y: getY(val) };
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`ylabel-${i}`}
            x={padding.left - 5}
            y={tick.y + 3}
            style={{ fontSize: 7, fill: "#6b7280" }}
            textAnchor="end"
          >
            ${tick.value.toLocaleString()}
          </SvgText>
        ))}

        {/* Line */}
        <Line
          x1={getX(0)}
          y1={getY(data[0].value)}
          x2={getX(data.length > 1 ? 1 : 0)}
          y2={getY(data.length > 1 ? data[1].value : data[0].value)}
          stroke={color}
          strokeWidth={0}
        />
        {data.length > 1 &&
          data.slice(1).map((d, i) => (
            <Line
              key={`line-${i}`}
              x1={getX(i)}
              y1={getY(data[i].value)}
              x2={getX(i + 1)}
              y2={getY(d.value)}
              stroke={color}
              strokeWidth={2}
            />
          ))}

        {/* Data points */}
        {data.map((d, i) => (
          <Circle
            key={`point-${i}`}
            cx={getX(i)}
            cy={getY(d.value)}
            r={3}
            fill={color}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <SvgText
            key={`xlabel-${i}`}
            x={getX(i)}
            y={height - 5}
            style={{ fontSize: 7, fill: "#6b7280" }}
            textAnchor="middle"
          >
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
```

**Step 2: Write StackedBarChart component**

`aws-optimizer/apps/web/src/components/pdf/StackedBarChart.tsx`:

```tsx
import React from "react";
import { View, StyleSheet, Svg, Rect, Text as SvgText, Line } from "@react-pdf/renderer";
import { Text } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: "#fafbfc",
    borderRadius: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  legendText: {
    fontSize: 6,
    color: "#6b7280",
  },
});

// Color palette for stacked bars
const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a78bfa", // light violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#84cc16", // lime
];

interface StackedBarChartProps {
  data: Array<{ month: string; accounts: Record<string, number>; total: number }>;
  title?: string;
  width?: number;
  height?: number;
}

export function StackedBarChart({
  data,
  title,
  width = 450,
  height = 200,
}: StackedBarChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 30, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get all unique account names
  const allAccounts = new Set<string>();
  for (const d of data) {
    for (const key of Object.keys(d.accounts)) {
      allAccounts.add(key);
    }
  }
  const accountNames = Array.from(allAccounts);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = (chartWidth / data.length) * 0.7;
  const barGap = (chartWidth / data.length) * 0.3;

  const getX = (i: number) => padding.left + i * (barWidth + barGap) + barGap / 2;
  const getBarHeight = (val: number) => (val / maxTotal) * chartHeight;

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxTotal * (4 - i)) / 4;
    return {
      value: Math.round(val),
      y: padding.top + (i / 4) * chartHeight,
    };
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`ylabel-${i}`}
            x={padding.left - 5}
            y={tick.y + 3}
            style={{ fontSize: 7, fill: "#6b7280" }}
            textAnchor="end"
          >
            ${tick.value.toLocaleString()}
          </SvgText>
        ))}

        {/* Stacked bars */}
        {data.map((d, monthIdx) => {
          let yOffset = 0;
          return accountNames.map((accName, accIdx) => {
            const value = d.accounts[accName] || 0;
            if (value === 0) return null;
            const barH = getBarHeight(value);
            const y = padding.top + chartHeight - yOffset - barH;
            yOffset += barH;

            return (
              <Rect
                key={`bar-${monthIdx}-${accIdx}`}
                x={getX(monthIdx)}
                y={y}
                width={barWidth}
                height={barH}
                fill={COLORS[accIdx % COLORS.length]}
              />
            );
          });
        })}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <SvgText
            key={`xlabel-${i}`}
            x={getX(i) + barWidth / 2}
            y={height - 5}
            style={{ fontSize: 7, fill: "#6b7280" }}
            textAnchor="middle"
          >
            {d.month}
          </SvgText>
        ))}
      </Svg>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {accountNames.slice(0, 10).map((name, i) => (
          <View key={name} style={styles.legendItem}>
            <View style={{ width: 8, height: 8, backgroundColor: COLORS[i % COLORS.length], borderRadius: 1 }} />
            <Text style={styles.legendText}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

**Step 3: Commit**

```bash
git add aws-optimizer/apps/web/src/components/pdf/LineChart.tsx aws-optimizer/apps/web/src/components/pdf/StackedBarChart.tsx
git commit -m "feat(reports): add SVG chart components for PDF (LineChart, StackedBarChart)"
```

---

### Task 9: Create the main CostAnalysisReportPdf component

**Files:**
- Create: `aws-optimizer/apps/web/src/components/CostAnalysisReportPdf.tsx`

**Step 1: Write the main PDF template**

```tsx
/**
 * Cost Analysis Report PDF Template
 *
 * Renders a structured, visually rich PDF from CostAnalysisReportData JSON.
 * Matches the style of professional AWS cost analysis reports with:
 * - Executive summary with gradient cards
 * - Top accounts table with color-coded changes
 * - Organization trends stacked bar chart
 * - Per-account detail pages with line charts, root cause analysis, service tables
 */

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CostAnalysisReportData } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";
import { SummaryCard } from "./pdf/SummaryCard";
import { DataTable } from "./pdf/DataTable";
import { LineChart } from "./pdf/LineChart";
import { StackedBarChart } from "./pdf/StackedBarChart";
import { RootCauseBlock } from "./pdf/RootCauseBlock";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.4,
  },
  headerBar: {
    backgroundColor: "#4f46e5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 9,
    color: "#c7d2fe",
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#4f46e5",
    paddingBottom: 4,
  },
  accountHeader: {
    borderLeftWidth: 3,
    borderLeftColor: "#4f46e5",
    paddingLeft: 10,
    marginBottom: 8,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  accountId: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  insightsBox: {
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
  },
  insightsText: {
    fontSize: 8,
    color: "#1e40af",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 30,
    fontSize: 7,
    color: "#94a3b8",
  },
});

function formatCurrency(value: number): string {
  return "$" + Math.abs(value).toLocaleString();
}

function changeColor(value: number): string {
  return value > 0 ? "#dc2626" : value < 0 ? "#16a34a" : "#6b7280";
}

interface CostAnalysisReportPdfProps {
  data: CostAnalysisReportData;
}

export function CostAnalysisReportPdf({ data }: CostAnalysisReportPdfProps) {
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      {/* Page 1: Executive Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{data.organizationName} - AWS Cost Analysis</Text>
          <Text style={styles.headerSubtitle}>
            {data.accountCount} Accounts | {data.comparisonMonths[0]} - {data.comparisonMonths[1]} | Generated: {generatedDate}
          </Text>
        </View>

        {/* Executive Summary */}
        <Text style={styles.sectionTitle}>Executive Summary</Text>

        <View style={styles.summaryRow}>
          <SummaryCard
            label={data.summary.currentMonth.name.toUpperCase()}
            value={formatCurrency(data.summary.currentMonth.total)}
            bgColor="#7c3aed"
          />
          <SummaryCard
            label={data.summary.previousMonth.name.toUpperCase()}
            value={formatCurrency(data.summary.previousMonth.total)}
            bgColor="#6366f1"
          />
          <SummaryCard
            label="MOM CHANGE"
            value={formatCurrency(data.summary.change)}
            subtitle={`${data.summary.changePercent > 0 ? "+" : ""}${data.summary.changePercent}%`}
            bgColor={data.summary.change <= 0 ? "#16a34a" : "#dc2626"}
          />
          <SummaryCard
            label="ACCOUNTS"
            value={String(data.accountCount)}
            bgColor="#3b82f6"
          />
        </View>

        {/* AI Executive Insights */}
        {data.executiveInsights && (
          <View style={styles.insightsBox}>
            <Text style={styles.insightsText}>{data.executiveInsights}</Text>
          </View>
        )}

        {/* Top Accounts Table */}
        <Text style={styles.sectionTitle}>Top {data.topAccounts.length} Accounts by Cost</Text>

        <DataTable
          columns={[
            { key: "name", label: "Account", width: 3 },
            {
              key: "previousMonth",
              label: data.comparisonMonths[0]?.split(" ")[0] || "Prev",
              align: "right",
              render: (v: number) => formatCurrency(v),
            },
            {
              key: "currentMonth",
              label: data.comparisonMonths[1]?.split(" ")[0] || "Current",
              align: "right",
              render: (v: number) => formatCurrency(v),
            },
            {
              key: "change",
              label: "Change",
              align: "right",
              render: (v: number) => `${v > 0 ? "+" : ""}${formatCurrency(v)}`,
              color: (v: number) => changeColor(v),
            },
            {
              key: "changePercent",
              label: "%",
              align: "right",
              render: (v: number) => `${v > 0 ? "+" : ""}${v}%`,
              color: (v: number) => changeColor(v),
            },
          ]}
          data={data.topAccounts}
        />

        <Text style={styles.footer}>AWS Cost Optimizer Report</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      {/* Page 2: Organization Trends */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Organization Trends</Text>

        <StackedBarChart
          data={data.organizationTrends}
          title="Monthly Cost by Account"
          width={530}
          height={250}
        />

        <Text style={styles.footer}>AWS Cost Optimizer Report</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      {/* Per-Account Detail Pages */}
      {data.accountDetails.map((account) => (
        <Page key={account.accountId} size="A4" style={styles.page}>
          {/* Account Header */}
          <View style={styles.accountHeader}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountId}>Account ID: {account.accountId}</Text>
          </View>

          {/* Account Summary Cards */}
          <View style={styles.summaryRow}>
            <SummaryCard
              label={data.comparisonMonths[1]?.toUpperCase() || "CURRENT"}
              value={formatCurrency(account.currentMonth)}
              bgColor="#7c3aed"
            />
            <SummaryCard
              label={data.comparisonMonths[0]?.toUpperCase() || "PREVIOUS"}
              value={formatCurrency(account.previousMonth)}
              bgColor="#6366f1"
            />
            <SummaryCard
              label="CHANGE"
              value={`${account.change > 0 ? "+" : ""}${formatCurrency(account.change)}`}
              bgColor={account.change <= 0 ? "#16a34a" : "#dc2626"}
            />
            <SummaryCard
              label="SERVICES"
              value={String(account.serviceCount)}
              bgColor="#3b82f6"
            />
          </View>

          {/* Monthly Trend Chart */}
          <LineChart
            data={account.monthlyTrend.map((d) => ({ label: d.month, value: d.cost }))}
            title="Monthly Trend"
            width={530}
            height={140}
          />

          {/* AI Insights */}
          {account.aiInsights && (
            <View style={styles.insightsBox}>
              <Text style={styles.insightsText}>{account.aiInsights}</Text>
            </View>
          )}

          {/* Root Cause Analysis */}
          <RootCauseBlock services={account.rootCauseAnalysis} />

          {/* Top Services Table */}
          {account.topServices.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { fontSize: 11 }]}>
                Top {account.topServices.length} Services (Last 3 Months)
              </Text>
              <DataTable
                columns={[
                  { key: "name", label: "Service", width: 3 },
                  ...Object.keys(account.topServices[0]?.costs || {}).map((month) => ({
                    key: `cost_${month}`,
                    label: month,
                    align: "right" as const,
                    render: (v: number) => (v != null ? formatCurrency(v) : "$0"),
                  })),
                ]}
                data={account.topServices.map((svc) => {
                  const row: Record<string, any> = { name: svc.name };
                  for (const [month, cost] of Object.entries(svc.costs)) {
                    row[`cost_${month}`] = cost;
                  }
                  return row;
                })}
              />
            </>
          )}

          <Text style={styles.footer}>AWS Cost Optimizer Report</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}

export default CostAnalysisReportPdf;
```

**Step 2: Commit**

```bash
git add aws-optimizer/apps/web/src/components/CostAnalysisReportPdf.tsx
git commit -m "feat(reports): add CostAnalysisReportPdf template component"
```

---

### Task 10: Update ReportsPage frontend

**Files:**
- Modify: `aws-optimizer/apps/web/src/pages/ReportsPage.tsx`

**Step 1: Add the CostAnalysisReportPdf import**

Near the top of the file (around line 61), add:

```typescript
import { CostAnalysisReportPdf } from "../components/CostAnalysisReportPdf";
import type { CostAnalysisReportData } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";
```

**Step 2: Update the Report and ReportDetail interfaces**

Add `hasReportData` to the `Report` interface (around line 89):

```typescript
  hasReportData?: boolean;
```

Add `reportData` to the `ReportDetail` interface (around line 106):

```typescript
  reportData?: string;
```

**Step 3: Add the generateCostAnalysis mutation**

After the existing mutations (around line 369), add:

```typescript
  const generateCostAnalysis = useMutation(api.reports.generateCostAnalysis);
```

**Step 4: Update the handleExportPdf to handle cost analysis reports**

Replace the existing `handleExportPdf` callback (around line 472-500) with:

```typescript
  const handleExportPdf = useCallback(async () => {
    if (!reportDetail) return;

    setIsExportingPdf(true);
    try {
      let blob: Blob;

      // Use CostAnalysisReportPdf for reports with structured data
      if (reportDetail.reportData) {
        const reportData: CostAnalysisReportData = JSON.parse(reportDetail.reportData);
        blob = await pdf(<CostAnalysisReportPdf data={reportData} />).toBlob();
      } else if (reportDetail.content) {
        // Fall back to markdown-based PDF for other report types
        blob = await pdf(
          <ReportPdfDocument
            title={reportDetail.name}
            content={reportDetail.content}
            reportType={reportDetail.type}
            generatedAt={reportDetail.completedAt || undefined}
          />
        ).toBlob();
      } else {
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportDetail.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExportingPdf(false);
    }
  }, [reportDetail]);
```

**Step 5: Update the handleGenerateReport to use the new cost analysis mutation**

Replace the existing `handleGenerateReport` callback (around line 439-448) with:

```typescript
  const handleGenerateReport = useCallback(async () => {
    const awsAccountIdsArg = selectedAwsAccountIds.length > 0 ? selectedAwsAccountIds : undefined;

    if (reportType === "summary") {
      // Use the new structured cost analysis report
      if (IS_TEST_MODE) {
        await generateCostAnalysis({ name: reportName, awsAccountIds: awsAccountIdsArg });
      } else {
        await generateCostAnalysis({ organizationId: organizationId!, name: reportName, awsAccountIds: awsAccountIdsArg });
      }
    } else {
      // Use existing AI markdown report for other types
      if (IS_TEST_MODE) {
        await generateReport({ name: reportName, type: reportType, format: reportFormat, awsAccountIds: awsAccountIdsArg });
      } else {
        await generateReport({ organizationId: organizationId!, name: reportName, type: reportType, format: reportFormat, awsAccountIds: awsAccountIdsArg });
      }
    }
    closeGenerateModal();
    resetGenerateForm();
  }, [reportName, reportType, reportFormat, selectedAwsAccountIds, organizationId, generateReport, generateCostAnalysis, closeGenerateModal, resetGenerateForm]);
```

**Step 6: Update the View button to also show for reports with reportData**

In the report actions column (around line 791), update the condition from:

```typescript
{report.status === "completed" && report.hasContent && (
```

to:

```typescript
{report.status === "completed" && (report.hasContent || report.hasReportData) && (
```

**Step 7: Commit**

```bash
git add aws-optimizer/apps/web/src/pages/ReportsPage.tsx
git commit -m "feat(reports): integrate CostAnalysisReportPdf into ReportsPage"
```

---

### Task 11: Copy shared types to web package

**Files:**
- Create: `aws-optimizer/apps/web/src/types/costAnalysisTypes.ts`

The types defined in `convex/ai/costAnalysisTypes.ts` need to be accessible from the web app. Since the web app already imports from `@aws-optimizer/convex` (e.g., `api`), verify the import path works. If it doesn't resolve (TypeScript path issue), create a re-export file:

**Step 1: Test the import path**

Check if `import type { CostAnalysisReportData } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes"` resolves. If it works, skip this task.

If it doesn't resolve, copy the types:

```typescript
// Re-export cost analysis types for web consumption
export type {
  CostAnalysisReportData,
  AccountSummary,
  AccountDetail,
  MonthlyTrend,
  RootCauseService,
  UsageTypeCost,
  ServiceCost,
} from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";
```

Or if that doesn't work either, duplicate the interface file at `aws-optimizer/apps/web/src/types/costAnalysisTypes.ts` and update all web imports to use the local copy.

**Step 2: Commit if changes were needed**

```bash
git add aws-optimizer/apps/web/src/types/
git commit -m "feat(reports): ensure cost analysis types are importable from web app"
```

---

### Task 12: Build and verify

**Step 1: Run Convex codegen**

```bash
cd aws-optimizer/packages/convex && npx convex dev --once
```

Expected: Schema pushes, new functions registered (costAnalysisData, costAnalysisInsights, costAnalysisReport)

**Step 2: Run existing tests**

```bash
cd aws-optimizer/packages/convex && npx vitest run
```

Expected: All existing tests still pass

**Step 3: Run web build**

```bash
cd aws-optimizer/apps/web && npm run build
```

Expected: No TypeScript errors, build succeeds

**Step 4: Commit if any fixes needed**

```bash
git add -A && git commit -m "fix: resolve build issues for cost analysis report"
```

---

### Task 13: Manual integration test

**Step 1: Start the dev environment**

```bash
cd aws-optimizer && npm run dev
```

**Step 2: Test report generation**

1. Navigate to the Reports page
2. Click "Generate Report"
3. Select "Summary" type (this now triggers cost analysis)
4. Verify progress updates appear in real-time
5. When complete, click "View" and then "Export PDF"
6. Verify the PDF contains: header, summary cards, top accounts table, trend charts, per-account details

**Step 3: Commit final state**

```bash
git add -A && git commit -m "feat(reports): complete organization cost analysis report implementation"
```
