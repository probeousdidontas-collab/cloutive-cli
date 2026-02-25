/**
 * Cost Analysis Data Fetcher
 *
 * Fetches cost data directly from AWS Cost Explorer via the sandbox execution
 * system. Produces a structured CostAnalysisReportData object that can be
 * rendered into a PDF report and enriched with AI insights later.
 *
 * Flow:
 *  1. Resolve org name + AWS accounts
 *  2. Fetch monthly cost-by-account for the full trend window
 *  3. Build account summaries, org-level trends, MoM changes
 *  4. For each "detail" account (>$100/month):
 *     a. Fetch cost-by-service breakdown
 *     b. For the top 3 increasing services, fetch usage-type breakdown
 *  5. Return CostAnalysisReportData (without AI insights)
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

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get the organization name by its ID.
 */
export const getOrganizationName = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args): Promise<string> => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error(`Organization not found: ${args.organizationId}`);
    }
    return org.name;
  },
});

// ============================================================================
// Helper – execute AWS CLI via sandbox
// ============================================================================

interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Execute an AWS CLI command against a specific account via the sandbox.
 * Throws on non-zero exit code.
 */
async function executeAwsCommand(
  ctx: { runAction: (ref: any, args: any) => Promise<any> },
  awsAccountId: Id<"awsAccounts">,
  command: string
): Promise<SandboxResult> {
  const result: SandboxResult = await ctx.runAction(
    api.sandbox.executeCommand,
    { awsAccountId, command }
  );

  if (result.exitCode !== 0 || !result.success) {
    const msg = result.stderr
      ? result.stderr.substring(0, 500)
      : "Unknown AWS CLI error";
    throw new Error(
      `AWS command failed (exit ${result.exitCode}): ${msg}\nCommand: ${command}`
    );
  }

  return result;
}

// ============================================================================
// Parsing helpers
// ============================================================================

/**
 * AWS Cost Explorer `get-cost-and-usage` returns JSON with `ResultsByTime`.
 * Each entry has `TimePeriod.Start` (YYYY-MM-DD) and `Groups[]` with
 * `Keys[]` and `Metrics.BlendedCost.Amount`.
 *
 * We parse this into:
 *   Record<monthKey, Record<groupKey, cost>>
 * where monthKey is "YYYY-MM" and groupKey depends on the GROUP_BY dimension
 * (e.g. account number or service name). Near-zero costs (<0.005) are filtered
 * out to keep the data concise.
 */
function parseCostExplorerResponse(
  rawJson: string
): Record<string, Record<string, number>> {
  const data = JSON.parse(rawJson);
  const result: Record<string, Record<string, number>> = {};

  if (!data.ResultsByTime || !Array.isArray(data.ResultsByTime)) {
    return result;
  }

  for (const period of data.ResultsByTime) {
    const startDate: string = period.TimePeriod?.Start ?? "";
    // Convert "2025-09-01" → "2025-09"
    const monthKey = startDate.substring(0, 7);
    if (!monthKey) continue;

    if (!result[monthKey]) {
      result[monthKey] = {};
    }

    if (!Array.isArray(period.Groups)) continue;

    for (const group of period.Groups) {
      const key: string = Array.isArray(group.Keys)
        ? group.Keys.join(", ")
        : String(group.Keys);
      const amount = parseFloat(
        group.Metrics?.BlendedCost?.Amount ?? "0"
      );

      // Filter out near-zero costs
      if (Math.abs(amount) < 0.005) continue;

      result[monthKey][key] = (result[monthKey][key] ?? 0) + amount;
    }
  }

  return result;
}

// ============================================================================
// Date / formatting helpers
// ============================================================================

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format "YYYY-MM" → short month name, e.g. "Sep".
 */
function formatMonthShort(yearMonth: string): string {
  const monthIndex = parseInt(yearMonth.split("-")[1], 10) - 1;
  return SHORT_MONTH_NAMES[monthIndex] ?? yearMonth;
}

/**
 * Format "YYYY-MM" → full name with year, e.g. "September 2025".
 */
function formatMonthFull(yearMonth: string): string {
  const parts = yearMonth.split("-");
  const monthIndex = parseInt(parts[1], 10) - 1;
  return `${FULL_MONTH_NAMES[monthIndex] ?? yearMonth} ${parts[0]}`;
}

/**
 * Calculate the start and end date for a Cost Explorer query spanning
 * `months` full calendar months back from today.
 *
 * The end date is the 1st of the *current* month (exclusive), and
 * the start date is `months` full months before that.
 *
 * Returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }.
 */
function getDateRange(months: number): { start: string; end: string } {
  const now = new Date();
  // End = first of current month (CE end date is exclusive)
  const endYear = now.getFullYear();
  const endMonth = now.getMonth(); // 0-based
  const end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-01`;

  // Start = `months` full months before end
  let startMonth = endMonth - months;
  let startYear = endYear;
  while (startMonth < 0) {
    startMonth += 12;
    startYear -= 1;
  }
  const start = `${startYear}-${String(startMonth + 1).padStart(2, "0")}-01`;

  return { start, end };
}

/**
 * Return sorted month keys between start and end (exclusive).
 * E.g. getMonthKeys("2025-07-01", "2025-10-01") → ["2025-07","2025-08","2025-09"]
 */
function getMonthKeys(start: string, end: string): string[] {
  const keys: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m < em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

// ============================================================================
// Main internal action
// ============================================================================

/**
 * Fetch cost analysis data from AWS Cost Explorer for an entire organization.
 *
 * Returns a fully-populated CostAnalysisReportData object (minus AI insights
 * which are added in a later step).
 */
export const fetchCostAnalysisData = internalAction({
  args: {
    organizationId: v.id("organizations"),
    awsAccountIds: v.optional(v.array(v.id("awsAccounts"))),
    trendMonths: v.optional(v.number()),
    topAccountCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CostAnalysisReportData> => {
    const trendMonths = args.trendMonths ?? 6;
    const topAccountCount = args.topAccountCount ?? 10;

    // ------------------------------------------------------------------
    // 1. Resolve org name and accounts
    // ------------------------------------------------------------------
    const [orgName, accounts] = await Promise.all([
      ctx.runQuery(internal.ai.costAnalysisData.getOrganizationName, {
        organizationId: args.organizationId,
      }),
      ctx.runQuery(internal.ai.reportGeneration.getAwsAccountsForOrg, {
        organizationId: args.organizationId,
        awsAccountIds: args.awsAccountIds,
      }),
    ]);

    if (!accounts || accounts.length === 0) {
      throw new Error(
        "No active AWS accounts found for this organization."
      );
    }

    console.log(
      `[CostAnalysis] Fetching data for org "${orgName}" with ${accounts.length} account(s), ` +
        `${trendMonths} months trend window`
    );

    // Build a lookup of Convex accountId → account metadata
    const accountMap = new Map<
      string,
      { _id: Id<"awsAccounts">; name: string; accountNumber: string }
    >();
    for (const acct of accounts) {
      accountMap.set(acct.accountNumber, {
        _id: acct._id as Id<"awsAccounts">,
        name: acct.name,
        accountNumber: acct.accountNumber,
      });
    }

    // Date range for the full trend window
    const { start, end } = getDateRange(trendMonths);
    const monthKeys = getMonthKeys(start, end);

    // We need at least 2 months to compute MoM change
    const currentMonthKey = monthKeys[monthKeys.length - 1];
    const previousMonthKey =
      monthKeys.length >= 2 ? monthKeys[monthKeys.length - 2] : currentMonthKey;

    // ------------------------------------------------------------------
    // 2. Fetch monthly cost grouped by LINKED_ACCOUNT (org-wide)
    // ------------------------------------------------------------------
    // We use the first account's credentials as the "management" account
    // to query Cost Explorer (CE returns data for all linked accounts in
    // a consolidated billing family).
    const primaryAccount = accounts[0];

    const ceAccountCommand =
      `aws ce get-cost-and-usage` +
      ` --time-period Start=${start},End=${end}` +
      ` --granularity MONTHLY` +
      ` --metrics BlendedCost` +
      ` --group-by Type=DIMENSION,Key=LINKED_ACCOUNT` +
      ` --filter '{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}'` +
      ` --output json`;

    console.log(`[CostAnalysis] Fetching account-level costs...`);
    const accountCostResult = await executeAwsCommand(
      ctx,
      primaryAccount._id as Id<"awsAccounts">,
      ceAccountCommand
    );

    const costByAccount = parseCostExplorerResponse(accountCostResult.stdout);

    // ------------------------------------------------------------------
    // 3. Build account totals and MoM changes
    // ------------------------------------------------------------------

    // Collect all discovered AWS account numbers from the CE response
    const allAccountNumbers = new Set<string>();
    for (const monthData of Object.values(costByAccount)) {
      for (const acctNum of Object.keys(monthData)) {
        allAccountNumbers.add(acctNum);
      }
    }

    // Build per-account current/previous month totals
    interface AccountAggregate {
      accountNumber: string;
      name: string;
      currentMonth: number;
      previousMonth: number;
      monthlyCosts: Record<string, number>; // monthKey → cost
    }

    const aggregates: AccountAggregate[] = [];

    for (const acctNum of allAccountNumbers) {
      const meta = accountMap.get(acctNum);
      const name = meta?.name ?? `Account ${acctNum}`;

      const monthlyCosts: Record<string, number> = {};
      for (const mk of monthKeys) {
        monthlyCosts[mk] = costByAccount[mk]?.[acctNum] ?? 0;
      }

      aggregates.push({
        accountNumber: acctNum,
        name,
        currentMonth: monthlyCosts[currentMonthKey] ?? 0,
        previousMonth: monthlyCosts[previousMonthKey] ?? 0,
        monthlyCosts,
      });
    }

    // Sort by current month cost descending
    aggregates.sort((a, b) => b.currentMonth - a.currentMonth);

    // Top N accounts for summary
    const topAggregates = aggregates.slice(0, topAccountCount);

    // ------------------------------------------------------------------
    // 4. Build topAccounts (AccountSummary[])
    // ------------------------------------------------------------------
    const topAccounts: AccountSummary[] = topAggregates.map((agg) => {
      const change = agg.currentMonth - agg.previousMonth;
      const changePercent =
        agg.previousMonth > 0
          ? (change / agg.previousMonth) * 100
          : agg.currentMonth > 0
            ? 100
            : 0;
      return {
        name: agg.name,
        accountId: agg.accountNumber,
        previousMonth: Math.round(agg.previousMonth * 100) / 100,
        currentMonth: Math.round(agg.currentMonth * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    });

    // ------------------------------------------------------------------
    // 5. Build organization-level monthly trends
    // ------------------------------------------------------------------
    const organizationTrends: MonthlyTrend[] = monthKeys.map((mk) => {
      const accountCosts: Record<string, number> = {};
      let total = 0;

      for (const agg of topAggregates) {
        const cost = agg.monthlyCosts[mk] ?? 0;
        if (cost >= 0.005) {
          accountCosts[agg.name] = Math.round(cost * 100) / 100;
          total += cost;
        }
      }

      // "Others" bucket for non-top accounts
      let othersCost = 0;
      for (const agg of aggregates.slice(topAccountCount)) {
        othersCost += agg.monthlyCosts[mk] ?? 0;
      }
      if (othersCost >= 0.005) {
        accountCosts["Others"] = Math.round(othersCost * 100) / 100;
        total += othersCost;
      }

      return {
        month: formatMonthShort(mk),
        accounts: accountCosts,
        total: Math.round(total * 100) / 100,
      };
    });

    // Org-level summary
    const orgCurrentTotal = aggregates.reduce(
      (sum, a) => sum + a.currentMonth,
      0
    );
    const orgPreviousTotal = aggregates.reduce(
      (sum, a) => sum + a.previousMonth,
      0
    );
    const orgChange = orgCurrentTotal - orgPreviousTotal;
    const orgChangePercent =
      orgPreviousTotal > 0
        ? (orgChange / orgPreviousTotal) * 100
        : orgCurrentTotal > 0
          ? 100
          : 0;

    // ------------------------------------------------------------------
    // 6. Build per-account detail pages for accounts > $100/month
    // ------------------------------------------------------------------
    const DETAIL_THRESHOLD = 100; // minimum current-month cost for detail
    const detailCandidates = aggregates.filter(
      (a) => a.currentMonth >= DETAIL_THRESHOLD
    );

    console.log(
      `[CostAnalysis] Building detail pages for ${detailCandidates.length} account(s) above $${DETAIL_THRESHOLD}/month`
    );

    const accountDetails: AccountDetail[] = [];

    for (const agg of detailCandidates) {
      // Find the Convex account ID for this AWS account number so we can
      // execute sandbox commands against it.
      const meta = accountMap.get(agg.accountNumber);
      if (!meta) {
        // If we don't have credentials for this account, skip detail
        console.log(
          `[CostAnalysis] Skipping detail for ${agg.accountNumber} – no credentials`
        );
        continue;
      }

      // 6a. Fetch service breakdown for this account
      const ceServiceCommand =
        `aws ce get-cost-and-usage` +
        ` --time-period Start=${start},End=${end}` +
        ` --granularity MONTHLY` +
        ` --metrics BlendedCost` +
        ` --group-by Type=DIMENSION,Key=SERVICE` +
        ` --filter '{"And":[{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}},{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["${agg.accountNumber}"]}}]}'` +
        ` --output json`;

      console.log(
        `[CostAnalysis] Fetching service breakdown for ${agg.name} (${agg.accountNumber})...`
      );

      let serviceCostMap: Record<string, Record<string, number>>;
      try {
        const serviceResult = await executeAwsCommand(
          ctx,
          meta._id,
          ceServiceCommand
        );
        serviceCostMap = parseCostExplorerResponse(serviceResult.stdout);
      } catch (err) {
        console.error(
          `[CostAnalysis] Failed to get service breakdown for ${agg.accountNumber}:`,
          err
        );
        // Continue with empty service data rather than failing the whole report
        serviceCostMap = {};
      }

      // Collect all service names across months
      const allServices = new Set<string>();
      for (const monthData of Object.values(serviceCostMap)) {
        for (const svc of Object.keys(monthData)) {
          allServices.add(svc);
        }
      }

      // Build ServiceCost array sorted by current month cost
      const serviceCosts: Array<{
        name: string;
        costs: Record<string, number>;
        currentCost: number;
        previousCost: number;
      }> = [];

      for (const svc of allServices) {
        const costs: Record<string, number> = {};
        for (const mk of monthKeys) {
          const val = serviceCostMap[mk]?.[svc] ?? 0;
          if (val >= 0.005) {
            costs[formatMonthShort(mk)] = Math.round(val * 100) / 100;
          }
        }
        const currentCost = serviceCostMap[currentMonthKey]?.[svc] ?? 0;
        const previousCost = serviceCostMap[previousMonthKey]?.[svc] ?? 0;

        serviceCosts.push({
          name: svc,
          costs,
          currentCost,
          previousCost,
        });
      }

      // Sort by current month cost desc, take top 10
      serviceCosts.sort((a, b) => b.currentCost - a.currentCost);
      const topServices: ServiceCost[] = serviceCosts
        .slice(0, 10)
        .map(({ name, costs }) => ({ name, costs }));

      // 6b. Root cause analysis – top 3 cost-increasing services
      const increasingServices = serviceCosts
        .filter((s) => s.currentCost - s.previousCost > 0.01)
        .sort(
          (a, b) =>
            b.currentCost - b.previousCost - (a.currentCost - a.previousCost)
        )
        .slice(0, 3);

      const rootCauseAnalysis: RootCauseService[] = [];

      for (const svc of increasingServices) {
        // Fetch usage type breakdown for this service
        const ceUsageTypeCommand =
          `aws ce get-cost-and-usage` +
          ` --time-period Start=${previousMonthKey}-01,End=${end}` +
          ` --granularity MONTHLY` +
          ` --metrics BlendedCost` +
          ` --group-by Type=DIMENSION,Key=USAGE_TYPE` +
          ` --filter '{"And":[{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}},{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["${agg.accountNumber}"]}},{"Dimensions":{"Key":"SERVICE","Values":["${svc.name}"]}}]}'` +
          ` --output json`;

        let usageTypes: Array<{
          name: string;
          previousCost: number;
          currentCost: number;
          change: number;
        }> = [];

        try {
          console.log(
            `[CostAnalysis] Fetching usage types for ${svc.name} in ${agg.accountNumber}...`
          );
          const usageResult = await executeAwsCommand(
            ctx,
            meta._id,
            ceUsageTypeCommand
          );
          const usageCostMap = parseCostExplorerResponse(usageResult.stdout);

          // Build usage type entries
          const allUsageTypes = new Set<string>();
          for (const monthData of Object.values(usageCostMap)) {
            for (const ut of Object.keys(monthData)) {
              allUsageTypes.add(ut);
            }
          }

          for (const ut of allUsageTypes) {
            const prev = usageCostMap[previousMonthKey]?.[ut] ?? 0;
            const curr = usageCostMap[currentMonthKey]?.[ut] ?? 0;
            usageTypes.push({
              name: ut,
              previousCost: Math.round(prev * 100) / 100,
              currentCost: Math.round(curr * 100) / 100,
              change: Math.round((curr - prev) * 100) / 100,
            });
          }

          // Sort by change desc, take top entries
          usageTypes.sort((a, b) => b.change - a.change);
          usageTypes = usageTypes.slice(0, 10);
        } catch (err) {
          console.error(
            `[CostAnalysis] Failed to get usage types for ${svc.name}:`,
            err
          );
          // Continue without usage type data
        }

        rootCauseAnalysis.push({
          serviceName: svc.name,
          previousCost: Math.round(svc.previousCost * 100) / 100,
          currentCost: Math.round(svc.currentCost * 100) / 100,
          change:
            Math.round((svc.currentCost - svc.previousCost) * 100) / 100,
          usageTypes,
        });
      }

      // Monthly trend for this account
      const monthlyTrend = monthKeys.map((mk) => ({
        month: formatMonthShort(mk),
        cost: Math.round((agg.monthlyCosts[mk] ?? 0) * 100) / 100,
      }));

      const change = agg.currentMonth - agg.previousMonth;

      accountDetails.push({
        name: agg.name,
        accountId: agg.accountNumber,
        currentMonth: Math.round(agg.currentMonth * 100) / 100,
        previousMonth: Math.round(agg.previousMonth * 100) / 100,
        change: Math.round(change * 100) / 100,
        serviceCount: allServices.size,
        monthlyTrend,
        rootCauseAnalysis,
        topServices,
      });
    }

    // ------------------------------------------------------------------
    // 7. Assemble final report data
    // ------------------------------------------------------------------
    const comparisonMonths = [
      formatMonthFull(previousMonthKey),
      formatMonthFull(currentMonthKey),
    ];

    const reportData: CostAnalysisReportData = {
      organizationName: orgName,
      accountCount: accounts.length,
      dateRange: { start, end },
      generatedAt: new Date().toISOString(),
      trendMonths,
      comparisonMonths,

      summary: {
        currentMonth: {
          name: formatMonthFull(currentMonthKey),
          total: Math.round(orgCurrentTotal * 100) / 100,
        },
        previousMonth: {
          name: formatMonthFull(previousMonthKey),
          total: Math.round(orgPreviousTotal * 100) / 100,
        },
        change: Math.round(orgChange * 100) / 100,
        changePercent: Math.round(orgChangePercent * 10) / 10,
      },

      topAccounts,
      organizationTrends,
      accountDetails,
    };

    console.log(
      `[CostAnalysis] Data fetch complete. ` +
        `${topAccounts.length} top accounts, ` +
        `${accountDetails.length} detail pages, ` +
        `${organizationTrends.length} trend months.`
    );

    return reportData;
  },
});
