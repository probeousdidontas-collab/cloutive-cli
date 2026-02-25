/**
 * Cost Analysis Report PDF Template
 *
 * Multi-page PDF document for Organization Cost Analysis reports.
 * Uses structured CostAnalysisReportData JSON to render:
 * - Executive summary with cards and AI insights
 * - Top accounts table
 * - Organization trends stacked bar chart
 * - Per-account detail pages with line charts, root cause analysis, and service tables
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { SummaryCard } from "./pdf/SummaryCard";
import { DataTable } from "./pdf/DataTable";
import { LineChart } from "./pdf/LineChart";
import { StackedBarChart } from "./pdf/StackedBarChart";
import { RootCauseBlock } from "./pdf/RootCauseBlock";
import type { CostAnalysisReportData } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  headerBar: {
    backgroundColor: "#4f46e5",
    padding: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: "#c7d2fe",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  insightsBox: {
    backgroundColor: "#f0f4ff",
    borderLeftWidth: 3,
    borderLeftColor: "#6366f1",
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  insightsLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4f46e5",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  insightsText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  accountHeaderBar: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  accountHeaderName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  accountHeaderId: {
    fontSize: 8,
    color: "#94a3b8",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
});

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function changeColor(value: number): string {
  if (value > 0) return "#dc2626";
  if (value < 0) return "#16a34a";
  return "#6b7280";
}

function changePrefix(value: number): string {
  return value > 0 ? "+" : "";
}

interface CostAnalysisReportPdfProps {
  data: CostAnalysisReportData;
}

export function CostAnalysisReportPdf({ data }: CostAnalysisReportPdfProps) {
  const topAccountColumns = [
    { key: "name", label: "Account", width: 2.5 },
    {
      key: "previousMonth",
      label: data.summary.previousMonth.name,
      width: 1,
      align: "right" as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      key: "currentMonth",
      label: data.summary.currentMonth.name,
      width: 1,
      align: "right" as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      key: "change",
      label: "Change",
      width: 1,
      align: "right" as const,
      render: (v: number) => `${changePrefix(v)}${formatCurrency(v)}`,
      color: (v: number) => changeColor(v),
    },
    {
      key: "changePercent",
      label: "Change %",
      width: 0.8,
      align: "right" as const,
      render: (v: number) => `${changePrefix(v)}${v}%`,
      color: (v: number) => changeColor(v),
    },
  ];

  return (
    <Document>
      {/* Page 1: Executive Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>
            {data.organizationName} - Cost Analysis Report
          </Text>
          <Text style={styles.headerSubtitle}>
            {data.accountCount} accounts • {data.comparisonMonths[0]} vs{" "}
            {data.comparisonMonths[1]} • Generated{" "}
            {new Date(data.generatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.cardsRow}>
          <SummaryCard
            label="CURRENT MONTH"
            value={formatCurrency(data.summary.currentMonth.total)}
            subtitle={data.summary.currentMonth.name}
            bgColor="#6366f1"
          />
          <SummaryCard
            label="PREVIOUS MONTH"
            value={formatCurrency(data.summary.previousMonth.total)}
            subtitle={data.summary.previousMonth.name}
            bgColor="#8b5cf6"
          />
          <SummaryCard
            label="MOM CHANGE"
            value={`${changePrefix(data.summary.change)}${formatCurrency(data.summary.change)}`}
            subtitle={`${changePrefix(data.summary.changePercent)}${data.summary.changePercent}%`}
            bgColor={data.summary.change > 0 ? "#dc2626" : "#16a34a"}
          />
          <SummaryCard
            label="ACCOUNTS"
            value={String(data.accountCount)}
            subtitle="Active accounts"
            bgColor="#3b82f6"
          />
        </View>

        {/* Executive Insights */}
        {data.executiveInsights && (
          <View style={styles.insightsBox}>
            <Text style={styles.insightsLabel}>AI EXECUTIVE INSIGHTS</Text>
            <Text style={styles.insightsText}>{data.executiveInsights}</Text>
          </View>
        )}

        {/* Top Accounts Table */}
        <Text style={styles.sectionTitle}>
          Top {data.topAccounts.length} Accounts by Cost
        </Text>
        <DataTable columns={topAccountColumns} data={data.topAccounts} />

        <PageFooter />
      </Page>

      {/* Page 2: Organization Trends */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Organization Cost Trends</Text>
        <StackedBarChart
          data={data.organizationTrends}
          title={`Monthly Cost by Account (${data.trendMonths} months)`}
          width={530}
          height={350}
        />

        <PageFooter />
      </Page>

      {/* Per-Account Detail Pages */}
      {data.accountDetails.map((account) => (
        <Page key={account.accountId} size="A4" style={styles.page}>
          {/* Account Header */}
          <View style={styles.accountHeaderBar}>
            <Text style={styles.accountHeaderName}>{account.name}</Text>
            <Text style={styles.accountHeaderId}>
              AWS Account: {account.accountId}
            </Text>
          </View>

          {/* Account Summary Cards */}
          <View style={styles.cardsRow}>
            <SummaryCard
              label="CURRENT MONTH"
              value={formatCurrency(account.currentMonth)}
              bgColor="#6366f1"
            />
            <SummaryCard
              label="PREVIOUS MONTH"
              value={formatCurrency(account.previousMonth)}
              bgColor="#8b5cf6"
            />
            <SummaryCard
              label="CHANGE"
              value={`${changePrefix(account.change)}${formatCurrency(account.change)}`}
              bgColor={account.change > 0 ? "#dc2626" : "#16a34a"}
            />
            <SummaryCard
              label="SERVICES"
              value={String(account.serviceCount)}
              bgColor="#3b82f6"
            />
          </View>

          {/* Monthly Trend Chart */}
          <LineChart
            data={account.monthlyTrend.map((m) => ({
              label: m.month,
              value: m.cost,
            }))}
            title="Monthly Cost Trend"
            width={530}
            height={140}
          />

          {/* AI Insights */}
          {account.aiInsights && (
            <View style={styles.insightsBox}>
              <Text style={styles.insightsLabel}>AI INSIGHTS</Text>
              <Text style={styles.insightsText}>{account.aiInsights}</Text>
            </View>
          )}

          {/* Root Cause Analysis */}
          {account.rootCauseAnalysis.length > 0 && (
            <RootCauseBlock services={account.rootCauseAnalysis} />
          )}

          {/* Top Services Table */}
          {account.topServices.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top Services</Text>
              <DataTable
                columns={buildServiceColumns(account.topServices)}
                data={account.topServices.map((svc) => ({
                  name: svc.name,
                  ...svc.costs,
                }))}
              />
            </>
          )}

          <PageFooter />
        </Page>
      ))}
    </Document>
  );
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>AWS Cost Optimizer Report</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

/**
 * Build column definitions for the services table dynamically based on available months.
 */
function buildServiceColumns(
  services: Array<{ name: string; costs: Record<string, number> }>
) {
  // Get all unique month keys from all services
  const monthKeys = new Set<string>();
  for (const svc of services) {
    for (const key of Object.keys(svc.costs)) {
      monthKeys.add(key);
    }
  }
  const months = Array.from(monthKeys);

  return [
    { key: "name", label: "Service", width: 2.5 },
    ...months.map((month) => ({
      key: month,
      label: month,
      width: 1,
      align: "right" as const,
      render: (v: number) => (v != null ? formatCurrency(v) : "-"),
    })),
  ];
}

export default CostAnalysisReportPdf;
