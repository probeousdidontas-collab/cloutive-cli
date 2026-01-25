/**
 * Cost Data Queries
 *
 * Features:
 * - Get cost data from cost snapshots for the cost explorer
 */

import { query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

/**
 * Get cost data for the cost explorer.
 * Transforms cost snapshots into individual cost records by service.
 */
export const getCostData = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      return [];
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const costRecords: Array<{
      _id: string;
      awsAccountId: string;
      date: string;
      service: string;
      region: string;
      cost: number;
      tags?: Record<string, string>;
    }> = [];

    // Transform cost snapshots into individual cost records
    for (const account of awsAccounts) {
      const snapshots = await ctx.db
        .query("costSnapshots")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
        .collect();

      for (const snapshot of snapshots) {
        // If we have service breakdown, create records for each service
        if (snapshot.serviceBreakdown && Object.keys(snapshot.serviceBreakdown).length > 0) {
          for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
            // Determine region from regionBreakdown or use default
            let region = "us-east-1";
            if (snapshot.regionBreakdown) {
              const regions = Object.keys(snapshot.regionBreakdown);
              if (regions.length > 0) {
                region = regions[0];
              }
            }

            costRecords.push({
              _id: `${snapshot._id}-${service}`,
              awsAccountId: account._id,
              date: snapshot.date,
              service,
              region,
              cost,
            });
          }
        } else {
          // No breakdown, create a single "Total" record
          costRecords.push({
            _id: `${snapshot._id}-total`,
            awsAccountId: account._id,
            date: snapshot.date,
            service: "Total",
            region: account.region || "us-east-1",
            cost: snapshot.totalCost,
          });
        }
      }
    }

    // Sort by date descending
    costRecords.sort((a, b) => b.date.localeCompare(a.date));

    return costRecords;
  },
});
