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

Please:

1. **Gather AWS Data** - Use the \`aws\` CLI tool to collect information about:
   - Account identity (\`aws sts get-caller-identity --profile ${profile}\`)
   - EC2 instances, EBS volumes, security groups
   - RDS databases
   - S3 buckets
   - Lambda functions
   - ECS/EKS clusters and services
   - VPCs, subnets, load balancers
   - IAM users, roles, and MFA status
   - CloudTrail, GuardDuty, CloudWatch alarms
   - SNS topics, SQS queues, EventBridge rules
   - Secrets Manager, Parameter Store
   - Route 53 hosted zones
   - CloudFront distributions
   - And any other relevant services you discover

2. **Analyze the Data** - Identify:
   - Security issues (MFA, public access, encryption, etc.)
   - Cost optimization opportunities
   - Reliability concerns (Multi-AZ, backups, etc.)
   - Performance issues
   - Operational excellence gaps

3. **Generate Report** - Create a detailed report based on the template at \`docs/AWS_ANALYSIS_TEMPLATE.md\`.
   - Fill in ALL sections with actual data from the AWS account
   - Calculate health scores based on findings
   - Provide specific, actionable recommendations
   - Include risk assessment with severity levels
   - Add an architecture diagram based on discovered resources

4. **Write the report** to \`${outputFile}\`

**Important:**
- Use \`--profile ${profile}\` ${regionFlag} for all AWS CLI commands
- If a region is not specified, try to detect the primary region or use eu-central-1 as default
- Be thorough - gather data from multiple services before writing the report
- Include actual resource IDs, names, and configurations in the report
- Calculate realistic scores based on findings
- Make the report actionable with specific recommendations

${clientName ? `**Client Name:** ${clientName}` : ''}
${consultantName ? `**Consultant Name:** ${consultantName}` : ''}

Start by gathering account information, then systematically collect data from each service category before generating the final report.`;
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
