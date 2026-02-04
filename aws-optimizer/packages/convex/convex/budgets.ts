/**
 * Budget Management
 *
 * Features:
 * - List budgets for an organization
 * - Create new budgets (organization-wide or account-specific)
 * - Update budget settings
 * - Remove budgets
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getUserOrgId } from "./authHelpers";

// Budget period validator
const budgetPeriodValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly")
);

/**
 * Calculate current spend for a budget based on cost snapshots.
 */
async function calculateCurrentSpend(
  ctx: QueryCtx,
  budget: Doc<"budgets">
): Promise<number> {
  const now = new Date();
  let startDate: string;
  
  // Calculate period start date
  switch (budget.period) {
    case "daily":
      startDate = now.toISOString().split("T")[0];
      break;
    case "weekly": {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      startDate = weekStart.toISOString().split("T")[0];
      break;
    }
    case "monthly":
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      break;
    case "quarterly": {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = `${now.getFullYear()}-${String(quarter * 3 + 1).padStart(2, "0")}-01`;
      break;
    }
    case "yearly":
      startDate = `${now.getFullYear()}-01-01`;
      break;
    default:
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  // If budget is for a specific account, get snapshots for that account
  if (budget.awsAccountId) {
    const snapshots = await ctx.db
      .query("costSnapshots")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", budget.awsAccountId!))
      .collect();
    
    return snapshots
      .filter((s) => s.date >= startDate)
      .reduce((sum, s) => sum + s.totalCost, 0);
  }

  // Otherwise, get all snapshots for the organization's accounts
  const awsAccounts = await ctx.db
    .query("awsAccounts")
    .withIndex("by_organization", (q) => q.eq("organizationId", budget.organizationId))
    .collect();

  let totalCost = 0;
  for (const account of awsAccounts) {
    const snapshots = await ctx.db
      .query("costSnapshots")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", account._id))
      .collect();
    
    totalCost += snapshots
      .filter((s) => s.date >= startDate)
      .reduce((sum, s) => sum + s.totalCost, 0);
  }

  return totalCost;
}

/**
 * List all budgets for the user's organization.
 * Accepts optional organizationId for multi-org support.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Use provided organizationId or fall back to auth context
    const organizationId = args.organizationId ?? await getUserOrgId(ctx);
    if (!organizationId) {
      return [];
    }

    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Calculate current spend for each budget
    const budgetsWithSpend = await Promise.all(
      budgets.map(async (budget) => {
        const currentSpend = await calculateCurrentSpend(ctx, budget);
        return {
          ...budget,
          currentSpend,
          scope: budget.awsAccountId ? "account" : "organization",
        };
      })
    );

    return budgetsWithSpend;
  },
});

/**
 * Create a new budget.
 */
export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    period: budgetPeriodValidator,
    alertThresholds: v.array(v.number()),
    scope: v.union(v.literal("organization"), v.literal("account")),
    awsAccountId: v.optional(v.union(v.id("awsAccounts"), v.null())),
  },
  handler: async (ctx, args) => {
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("No organization found");
    }

    const now = Date.now();

    const budgetId = await ctx.db.insert("budgets", {
      organizationId,
      awsAccountId: args.scope === "account" && args.awsAccountId ? args.awsAccountId : undefined,
      name: args.name,
      amount: args.amount,
      period: args.period,
      alertThresholds: args.alertThresholds,
      createdAt: now,
      updatedAt: now,
    });

    return { budgetId };
  },
});

/**
 * Update an existing budget.
 */
export const update = mutation({
  args: {
    id: v.id("budgets"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    period: v.optional(budgetPeriodValidator),
    alertThresholds: v.optional(v.array(v.number())),
    scope: v.optional(v.union(v.literal("organization"), v.literal("account"))),
    awsAccountId: v.optional(v.union(v.id("awsAccounts"), v.null())),
  },
  handler: async (ctx, args) => {
    // Get the user's organization
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("Not authenticated");
    }

    const budget = await ctx.db.get(args.id);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Verify the budget belongs to the user's organization
    if (budget.organizationId !== organizationId) {
      throw new Error("Access denied");
    }

    const updates: Partial<Doc<"budgets">> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.period !== undefined) updates.period = args.period;
    if (args.alertThresholds !== undefined) updates.alertThresholds = args.alertThresholds;
    if (args.scope !== undefined) {
      updates.awsAccountId = args.scope === "account" && args.awsAccountId ? args.awsAccountId : undefined;
    }

    await ctx.db.patch(args.id, updates);

    return { success: true };
  },
});

/**
 * Remove a budget.
 */
export const remove = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    // Get the user's organization
    const organizationId = await getUserOrgId(ctx);
    if (!organizationId) {
      throw new Error("Not authenticated");
    }

    const budget = await ctx.db.get(args.id);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Verify the budget belongs to the user's organization
    if (budget.organizationId !== organizationId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.id);

    return { success: true };
  },
});
