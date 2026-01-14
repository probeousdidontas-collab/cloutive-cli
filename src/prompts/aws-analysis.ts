/**
 * Generates the prompt for Codebuff to analyze AWS infrastructure
 */
export function generateAWSAnalysisPrompt(options: {
  profile: string;
  region?: string;
  clientName?: string;
  consultantName?: string;
  outputFile: string;
}): string {
  const { profile, region, clientName, consultantName, outputFile } = options;

  const regionFlag = region ? `--region ${region}` : '';

  return `You have access to the \`aws\` CLI tool with profile \`${profile}\`${region ? ` and region \`${region}\`` : ''}.

I need you to create a comprehensive AWS Infrastructure Analysis Report.

You are an expert AWS Solutions Architect specializing in cost analysis and optimization. Your role is to analyze AWS account costs comprehensively, identify cost trends and anomalies, investigate root causes, and provide actionable cost reduction recommendations.

Please follow this structured approach:

1. **Pre-flight & Discovery**
   - Verify account identity and aliases
   - Detect if this is an Organizations management account (\`aws organizations describe-organization\`)
   - If it is a management account, enumerate member accounts to analyze them individually where possible

2. **Rigorous Data Collection (CRITICAL)**
   - **Cost Data**: Retrieve **6 months** of cost data from AWS Cost Explorer (granularity: MONTHLY).
     - **Constraint**: NEVER aggregate to a single 6-month total. Data must be month-by-month.
     - **Constraint**: ALWAYS exclude the "Tax" service from all queries and analysis.
   - **Service Data**: Collect detailed metrics for:
     - EC2 (instances, types, CPU/Network metrics for rightsizing)
     - RDS (engines, versions, utilization, connections)
     - S3 (storage classes, sizes, public access)
     - Lambda (invocations, errors, duration)
     - IAM (users, roles, MFA status, key ages)
     - Security (Security Groups with open ports, CloudTrail, GuardDuty)
     - Other resources (VPCs, Load Balancers, CloudFront, Route53, etc.)

3. **Deep-Dive Cost Analysis**
   - **Trend Analysis**: Calculate month-over-month changes. Key on *change in behavior*, not just absolute cost.
   - **Anomaly Detection**: Identify services where cost patterns deviate significantly from their 6-month historical mean.
   - **Reservations**: Check for Reservations/Savings Plans expiring in 90 days.
   - **Optimization**: Look for specific opportunities (e.g., "Move 5TB from gp2 to gp3", "Stop 3 idle instances").
   - **Usage vs Service**: Prioritize "Usage Cost" analysis (UnblendedCost + UsageQuantity) to find the root cause of spikes.

4. **Security & Reliability Assessment**
   - Check against best practices (CIS Benchmark, Well-Architected Framework).
   - Identify critical security risks (public buckets, open SG ports, root account usage).
   - Assess reliability (Multi-AZ, backup strategies).

5. **Generate Report**
   - Create a detailed report based on the template at \`docs/AWS_ANALYSIS_TEMPLATE.md\`.
   - **Section 5 (Cost)** must be extremely detailed, following the "Cost Analyzer" standards:
     - Show monthly breakdown (not totals).
     - Highlight specific "Top Cost Increases" and "Top Cost Decreases".
     - Provide a "Service-Level" breakdown for top spenders.
     - Include a specific "Reservations & Savings Plans" status.
   - **Scores**: Calculate realistic health scores based on your findings (0-100).
   - **Recommendations**: Must be ACTIONABLE and formatted with specific potential savings where possible.

**Critical Rules:**
1. **No Aggregation**: Never show "Total 6-Month Cost". Show trend data (e.g., June: $X, July: $Y...).
2. **No Tax**: Explicitly filter out "Tax" service from all charts/tables.
3. **Real Data Only**: Do not use placeholders. If data is missing, state that.
4. **Visuals**: If producing Markdown, use tables to represent data clearly. If producing HTML, use ApexCharts.
5. **Context**: Use \`--profile ${profile}\` ${regionFlag} for all commands.

${clientName ? `**Client Name:** ${clientName}` : ''}
${consultantName ? `**Consultant Name:** ${consultantName}` : ''}

Start by gathering account information, then systematically collect data (Cost First, then Services), and finally generate the final report to \`${outputFile}\`.`;
}

/**
 * Generates a minimal prompt for quick AWS snapshot
 */
export function generateQuickSnapshotPrompt(options: {
  profile: string;
  region?: string;
  outputFile: string;
}): string {
  const { profile, region, outputFile } = options;
  const regionFlag = region ? `--region ${region}` : '';

  return `You have access to the \`aws\` CLI tool with profile \`${profile}\`${region ? ` and region \`${region}\`` : ''}.

Create a quick AWS system snapshot showing:
- Account ID and current user
- Running services (EC2, RDS, ECS, Lambda count)
- S3 buckets count
- Any critical alarms or security issues

Use \`--profile ${profile}\` ${regionFlag} for all commands.

Write a concise markdown summary to \`${outputFile}\`.`;
}
