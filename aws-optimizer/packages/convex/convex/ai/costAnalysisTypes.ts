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
