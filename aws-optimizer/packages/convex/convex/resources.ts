/**
 * Resources Management
 *
 * Features:
 * - List AWS resources discovered for an organization
 */

import { query } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

/**
 * List all resources for the user's organization.
 */
export const list = query({
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

    const awsAccountIds = awsAccounts.map((a) => a._id);

    if (awsAccountIds.length === 0) {
      return [];
    }

    // Get all resources for these accounts
    const allResources = [];

    for (const awsAccountId of awsAccountIds) {
      const resources = await ctx.db
        .query("resources")
        .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
        .collect();

      allResources.push(...resources);
    }

    // Sort by monthly cost descending
    allResources.sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0));

    return allResources;
  },
});
