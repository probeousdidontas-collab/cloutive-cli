/**
 * Idempotent seed migration for system default report prompts.
 *
 * Populates reportPrompts and reportPromptVersions with the 6 built-in
 * prompt types derived from the hardcoded prompts in:
 *   - ai/reportGeneration.ts  (5 report types)
 *   - ai/costAnalysisInsights.ts  (1 insights type)
 *
 * Safe to run multiple times — checks for existing system defaults before inserting.
 */

import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

type SectionFieldType = "textarea" | "text" | "select";

interface PromptSection {
  key: string;
  label: string;
  value: string;
  fieldType: SectionFieldType;
  options?: string[];
}

interface PromptSeed {
  type: string;
  label: string;
  sections: PromptSection[];
}

// ---------------------------------------------------------------------------
// Shared base instructions used by all 5 report-generation prompts
// ---------------------------------------------------------------------------
const BASE_INSTRUCTIONS = `You are generating an AWS cost/resource report.

**Important Instructions:**
1. Use the aws_listAccounts tool first to verify account access
2. For each account, use the appropriate tools to gather data
3. Generate a comprehensive markdown report with your findings
4. Include tables, charts (as ASCII if needed), and actionable insights
5. Format the output as clean markdown that can be displayed directly`;

const TOOL_USAGE_DEFAULT = `Use the relevant AWS tools to gather data (aws_getCostData, aws_listResources, aws_getReservations, etc.).
Format the report in clean markdown with tables for data and clear section headers.`;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const SYSTEM_PROMPTS: PromptSeed[] = [
  {
    type: "cost_analysis",
    label: "Cost Analysis",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: BASE_INSTRUCTIONS,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `**Report Type: Cost Analysis**

Generate a comprehensive cost analysis report that includes:

1. **Executive Summary** - High-level cost overview
2. **Cost Breakdown by Service** - Top spending services with percentages
3. **Cost Breakdown by Region** - Geographic cost distribution
4. **Cost Trends** - Daily/weekly/monthly trends (use aws_getCostData with different date ranges)
5. **Cost Anomalies** - Any unusual spending patterns detected
6. **Month-over-Month Comparison** - How costs compare to previous periods`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage & Formatting",
        value: `Use the aws_getCostData tool with appropriate date ranges (last 30 days, last 7 days, etc.) to gather this information.

Format the report in clean markdown with tables for data and clear section headers.`,
        fieldType: "textarea",
      },
    ],
  },

  {
    type: "savings_summary",
    label: "Savings Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: BASE_INSTRUCTIONS,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `**Report Type: Savings Summary**

Generate a savings opportunity report that includes:

1. **Executive Summary** - Total potential savings identified
2. **Reserved Instance Opportunities** - RI recommendations using aws_getReservations
3. **Savings Plan Opportunities** - SP recommendations
4. **Rightsizing Recommendations** - Instances that could be downsized (use aws_listResources for ec2)
5. **Unused Resources** - Resources with low or no utilization
6. **Quick Wins** - Easy-to-implement savings (< 1 hour effort)
7. **Implementation Roadmap** - Prioritized list of actions`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage & Formatting",
        value: `Use aws_getReservations, aws_listResources (for ec2, rds, ebs), and aws_getCostData to gather this information.
Use the recommendation_save tool to persist each recommendation found.

Format with clear estimated savings amounts and implementation effort levels.`,
        fieldType: "textarea",
      },
    ],
  },

  {
    type: "resource_inventory",
    label: "Resource Inventory",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: BASE_INSTRUCTIONS,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `**Report Type: Resource Inventory**

Generate a comprehensive resource inventory report that includes:

1. **Executive Summary** - Total resource counts by type
2. **EC2 Instances** - All instances with details (use aws_listResources with resourceType: ec2)
3. **RDS Databases** - All databases with configurations
4. **S3 Buckets** - All buckets with size estimates
5. **Lambda Functions** - All functions with memory/timeout configs
6. **Load Balancers** - ELB/ALB inventory
7. **Storage Volumes** - EBS volumes with utilization
8. **Resource Tags Analysis** - Tag coverage and consistency`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage & Formatting",
        value: `For each resource found, use the analysis_saveResource tool to persist it to the inventory.

Format with detailed tables showing resource attributes, estimated costs, and tags.`,
        fieldType: "textarea",
      },
    ],
  },

  {
    type: "recommendation_summary",
    label: "Recommendation Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: BASE_INSTRUCTIONS,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `**Report Type: Recommendation Summary**

Generate a prioritized recommendations report that includes:

1. **Executive Summary** - Total recommendations and potential savings
2. **Critical Recommendations** - High-impact, urgent items
3. **High Priority** - Significant savings opportunities
4. **Medium Priority** - Moderate effort/savings tradeoff
5. **Low Priority** - Nice-to-have optimizations
6. **Implementation Timeline** - Suggested order of implementation
7. **Risk Assessment** - Potential risks for each recommendation`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage & Formatting",
        value: `Analyze costs, resources, and reservations to identify recommendations.
Use the recommendation_save tool to persist each recommendation found.

Include estimated savings, effort level, and risk for each recommendation.`,
        fieldType: "textarea",
      },
    ],
  },

  {
    type: "executive_summary",
    label: "Executive Summary",
    sections: [
      {
        key: "base_instructions",
        label: "Base Instructions",
        value: BASE_INSTRUCTIONS,
        fieldType: "textarea",
      },
      {
        key: "report_sections",
        label: "Report Sections",
        value: `**Report Type: Executive Summary**

Generate a concise executive summary report suitable for leadership that includes:

1. **Key Metrics Dashboard**
   - Total monthly spend
   - Month-over-month change
   - Total potential savings identified
   - RI/SP coverage percentage

2. **Top 3 Cost Drivers** - Biggest spending areas

3. **Top 3 Savings Opportunities** - Quick wins with highest ROI

4. **Trend Analysis** - Cost trajectory and predictions

5. **Action Items** - Prioritized list of recommended next steps

6. **Risk Alerts** - Any concerning patterns or issues`,
        fieldType: "textarea",
      },
      {
        key: "tool_usage",
        label: "Tool Usage & Formatting",
        value: `${TOOL_USAGE_DEFAULT}

Keep this report concise (1-2 pages equivalent) with visual elements where helpful.
Focus on business impact and actionable insights.`,
        fieldType: "textarea",
      },
    ],
  },

  {
    type: "cost_analysis_insights",
    label: "Cost Analysis Insights (AI Commentary)",
    sections: [
      {
        key: "role_definition",
        label: "Role Definition",
        value: "You are an AWS cost optimization expert.",
        fieldType: "text",
      },
      {
        key: "executive_summary_instructions",
        label: "Executive Insights Instructions",
        value: `Based on the provided AWS cost data, write a concise executive insights paragraph (3-5 sentences).
Focus on: key cost drivers, notable trends, and urgent areas needing attention.
Be specific with numbers.
Do NOT use markdown formatting - plain text only.`,
        fieldType: "textarea",
      },
      {
        key: "account_commentary_rules",
        label: "Per-Account Commentary Rules",
        value: `Based on the provided account cost data, write 1-2 sentences of insight about what's driving costs and any recommended actions.
Be specific.
Plain text only, no markdown.`,
        fieldType: "textarea",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mutations / Actions
// ---------------------------------------------------------------------------

export const insertPrompt = internalMutation({
  handler: async (ctx, { prompt }: { prompt: PromptSeed }) => {
    const now = Date.now();

    // Idempotency check: skip if a system default for this type already exists
    const existing = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_system", (q) =>
        q.eq("type", prompt.type).eq("isSystem", true)
      )
      .first();

    if (existing) return;

    const promptId = await ctx.db.insert("reportPrompts", {
      type: prompt.type,
      label: prompt.label,
      isSystem: true,
      sections: prompt.sections,
      freeformSuffix: "",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("reportPromptVersions", {
      promptId,
      version: 1,
      sections: prompt.sections,
      freeformSuffix: "",
      changeMessage: "Initial seed",
      createdAt: now,
    });
  },
});

export const seed = internalAction({
  handler: async (ctx) => {
    for (const prompt of SYSTEM_PROMPTS) {
      await ctx.runMutation(
        internal.migrations.seedReportPrompts.insertPrompt,
        { prompt }
      );
    }
  },
});
