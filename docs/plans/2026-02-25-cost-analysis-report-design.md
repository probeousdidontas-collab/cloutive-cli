# Organization Cost Analysis Report - Design Document

**Date:** 2026-02-25
**Status:** Approved

## Overview

Implement a structured, visually rich Organization Cost Analysis report (PDF) that replicates the style of a professional AWS cost analysis report with executive summaries, per-account breakdowns, trend charts, and root cause analysis. Uses a hybrid approach: direct AWS Cost Explorer data for accuracy + AI for executive insights and root cause commentary.

## Report Structure

### Page 1-2: Organization Overview

- **Header**: Org name, account count, date range (configurable, default 6 months), generated date
- **Executive Summary Cards**: Current month total, Previous month total, MoM change ($, %), Account count
- **AI Executive Insights**: Short paragraph summarizing key findings
- **Top 15 Accounts by Cost**: Table with account name, previous month, current month, change $, change %
- **Organization Trends**: Stacked bar chart (top 8-10 accounts across N months)

### Pages 3+: Per-Account Detail (top N accounts by cost)

For each significant account:
- **Account Header**: Name, AWS Account ID
- **Summary Cards**: Current month, Previous month, Change, Service count
- **Monthly Trend Line Chart**: Cost over N months
- **Root Cause Analysis**: Top 3 cost-increasing services with usage-type breakdown
- **AI Commentary**: Per-account insights (optional, for accounts with significant changes)
- **Top 10 Services Table**: Last 3 months of costs

## Data Architecture

### Approach: Hybrid (Direct Data + AI Enhancement)

**Data layer** (deterministic, accurate):
- AWS Cost Explorer API fetches monthly costs per account, per service, per usage type
- Structured JSON stored in `reportData` field

**AI layer** (insights, commentary):
- AI agent receives the structured cost data
- Generates executive insights paragraph and per-account commentary
- AI text stored within the same JSON structure

### Report Data Schema

```typescript
interface CostAnalysisReportData {
  organizationName: string;
  accountCount: number;
  dateRange: { start: string; end: string };
  generatedAt: string;
  trendMonths: number;

  summary: {
    currentMonth: { name: string; total: number };
    previousMonth: { name: string; total: number };
    change: number;
    changePercent: number;
  };

  executiveInsights?: string;

  topAccounts: Array<{
    name: string;
    accountId: string;
    previousMonth: number;
    currentMonth: number;
    change: number;
    changePercent: number;
  }>;

  organizationTrends: Array<{
    month: string;
    accounts: Record<string, number>;
  }>;

  accountDetails: Array<{
    name: string;
    accountId: string;
    currentMonth: number;
    previousMonth: number;
    change: number;
    serviceCount: number;

    monthlyTrend: Array<{ month: string; cost: number }>;

    rootCauseAnalysis: Array<{
      serviceName: string;
      previousCost: number;
      currentCost: number;
      change: number;
      usageTypes: Array<{
        name: string;
        previousCost: number;
        currentCost: number;
        change: number;
      }>;
    }>;

    aiInsights?: string;

    topServices: Array<{
      name: string;
      costs: Record<string, number>;
    }>;
  }>;
}
```

### AWS Cost Explorer API Calls

1. **Monthly totals (N months)**: `get-cost-and-usage` MONTHLY granularity, grouped by LINKED_ACCOUNT
2. **Service breakdown (3 months)**: `get-cost-and-usage` grouped by SERVICE per account
3. **Usage type breakdown (2 months)**: `get-cost-and-usage` grouped by USAGE_TYPE, filtered by top cost-increasing services

Optimization: Bulk calls at org level for steps 1 and 2, targeted per-account calls for step 3.

## PDF Template (React-PDF)

### Visual Design

- Gradient header bar (purple-to-blue) with org name and metadata
- Summary cards with colored backgrounds (purple, blue, gradient green/red for change)
- Tables with header row styling, alternating rows, color-coded change values
- SVG-based charts within react-pdf (stacked bar charts, line charts)
- Root cause blocks with colored left border accent and nested usage breakdown
- Color coding: green for decreases, red for increases

### Chart Implementation

Using `@react-pdf/renderer` SVG primitives (`Svg`, `Rect`, `Line`, `Circle`, `Text`):
- **Stacked Bar Chart**: SVG rectangles with labels
- **Line Chart**: SVG polyline with data points

## Configuration

Default values (configurable per report generation):
- Trend months: 6
- Top accounts in summary: 15
- Detail pages: top N accounts (default: all accounts above $100/month)
- Service breakdown months: 3
- Root cause: top 3 cost-increasing services per account

## Files to Create

1. `aws-optimizer/packages/convex/convex/ai/costAnalysisReport.ts` - Data fetching + AI pipeline
2. `aws-optimizer/apps/web/src/components/CostAnalysisReportPdf.tsx` - PDF template
3. `aws-optimizer/apps/web/src/components/pdf/SummaryCard.tsx` - Reusable card component
4. `aws-optimizer/apps/web/src/components/pdf/TrendChart.tsx` - SVG line chart
5. `aws-optimizer/apps/web/src/components/pdf/StackedBarChart.tsx` - SVG stacked bar chart
6. `aws-optimizer/apps/web/src/components/pdf/DataTable.tsx` - Styled table component
7. `aws-optimizer/apps/web/src/components/pdf/RootCauseBlock.tsx` - Root cause analysis block

## Files to Modify

1. `aws-optimizer/packages/convex/convex/schema.ts` - Add `reportData` field to reports table
2. `aws-optimizer/packages/convex/convex/reports.ts` - Add `generateCostAnalysis` mutation with date range params
3. `aws-optimizer/apps/web/src/pages/ReportsPage.tsx` - Cost analysis report type, date range config, new PDF download
4. `aws-optimizer/packages/convex/convex/ai/reportGeneration.ts` - New progress steps for multi-step pipeline

## Backward Compatibility

- Existing `ReportPdfDocument.tsx` unchanged (used for other report types)
- Existing report generation flow unchanged for non-cost-analysis types
- New `reportData` field is optional, old reports continue to work
- Report type mapping in `reports.ts` stays compatible

## Progress Steps (Real-time UI)

1. Initializing (5%)
2. Fetching AWS accounts (15%)
3. Collecting cost data - monthly totals (30%)
4. Collecting cost data - service breakdown (50%)
5. Collecting cost data - usage type analysis (65%)
6. AI generating insights (80%)
7. Building report (90%)
8. Complete (100%)
