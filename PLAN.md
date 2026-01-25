# Plan: AWS Cost Optimizer SaaS Platform (AI-First)

## Overview

An AI-first SaaS platform for AWS cost analysis and optimization. The Convex Agent component drives all analysis workflows autonomously, with Cloudflare Containers providing secure sandbox execution of AWS CLI commands. Users can also run manual/ad-hoc commands when needed.

**Target Users:**
- End Customers (Self-service): AWS users managing their own accounts
- Partners/Consultants: AWS partners managing client accounts
- Both with separate dashboards

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite + Mantine v8 |
| **Routing** | TanStack Router |
| **State Management** | MobX + MobX React Lite |
| **Backend** | Convex (real-time database, functions, actions) |
| **AI Engine** | `@convex-dev/agent` with OpenRouter (multi-model access) |
| **Sandbox Execution** | Cloudflare Containers (`@cloudflare/sandbox`) with AWS CLI v2 |
| **Deployment** | Cloudflare Workers/Pages |
| **Testing** | Vitest + Testing Library |

## Convex Components

| Component | Package | Purpose |
|-----------|---------|---------|
| **Agent** | `@convex-dev/agent` | Primary workflow driver - autonomous AWS analysis, recommendations, chat |
| **Stripe** | `@convex-dev/stripe` | Subscription billing, usage-based pricing |
| **Better Auth** | `@convex-dev/better-auth` | Email/password authentication |
| **Rate Limiter** | `@convex-dev/rate-limiter` | Protect sandbox execution, API rate limiting |
| **Resend** | `@convex-dev/resend` | Transactional emails (alerts, reports, invites) |
| **Workpool** | `@convex-dev/workpool` | Queue sandbox jobs with priority |
| **Action Retrier** | `@convex-dev/action-retrier` | Retry failed AWS/sandbox calls |

## AI-First Architecture

### AI Agent as Primary Driver

The AI agent autonomously:
- Connects to customer AWS accounts and runs discovery
- Executes cost analysis workflows (daily/weekly/on-demand)
- Generates savings recommendations with explanations
- Answers natural language questions about costs
- Creates and sends reports
- Monitors for anomalies and triggers alerts

### Agent Tools (AWS Operations)

```
aws_executeCommand        - Execute any AWS CLI command in sandbox
aws_getCostData           - Fetch Cost Explorer data for date range
aws_listResources         - Inventory EC2, RDS, S3, etc.
aws_getReservations       - Get RI/Savings Plan coverage
aws_assumeRole            - Assume cross-account role
analysis_saveCostSnapshot - Store analyzed cost data
analysis_generateReport   - Create PDF/CSV report
analysis_createAlert      - Set up budget/anomaly alert
recommendation_save       - Store savings recommendation
notification_send         - Send email via Resend
```

### Workflow Modes

1. **AI-Driven (Primary)**: User asks question or schedules analysis → Agent autonomously executes AWS commands, analyzes results, stores data, generates insights
2. **Manual/Ad-hoc**: User directly executes AWS commands via UI → Results displayed and optionally stored

### Agent Configuration Example

```typescript
export const awsCostAgent = new Agent(components.agent, {
  name: "AWSCostOptimizer",
  languageModel: openrouter("anthropic/claude-sonnet-4"),
  tools: { ...awsTools, ...analysisTools, ...notificationTools },
  maxSteps: 100,
  instructions: `You are an AWS cost optimization expert...`
});
```

## Core Requirements

### Multi-Tenancy & Users
- Organizations with team members and roles (owner, admin, member, viewer)
- Separate dashboards for customers vs. partners
- Partner accounts manage multiple customer organizations
- Email/password authentication via Better Auth

### Subscription & Billing (Stripe)
- Tiered plans: Free (1 AWS account), Pro (5 accounts), Enterprise (unlimited)
- Usage-based pricing for AI analysis runs
- Stripe Customer Portal integration

### AWS Account Connection (All Methods Supported)
- Cross-account IAM role assumption (recommended, secure)
- AWS access key/secret (encrypted at rest)
- AWS Organizations API for partners
- Manual CSV/JSON data import option

### AWS Data Integration
- Cost Explorer API for historical cost/usage data
- EC2, RDS, S3 resource inventory with pricing
- Reserved Instances and Savings Plans analysis
- Billing and invoice data

### Sandbox Worker
- Cloudflare Container with AWS CLI v2 pre-installed
- Called by AI agent tools or manual UI
- Per-organization isolation (one sandbox per org)
- Ephemeral/job-based lifecycle
- Rate limited with retries

### AI-Driven Analysis Features
- **Cost Analysis**: "Analyze my AWS costs for last month"
- **Anomaly Detection**: "Alert me if daily spend exceeds $X"
- **Recommendations**: "Find ways to reduce my EC2 costs"
- **Forecasting**: "Predict my costs for next quarter"
- **Reports**: "Generate a monthly cost report for stakeholders"
- **Q&A**: "Why did my S3 costs spike last Tuesday?"

### Manual/Ad-hoc Features
- Direct AWS CLI command execution
- Raw JSON response viewing
- Command history per organization
- Export results to CSV

### Scheduled Jobs (Crons)
- Daily cost data collection (AI-driven)
- Weekly summary email generation
- Monthly report delivery
- Cleanup of old snapshots

### Dashboard & Visualization
- Cost breakdown by service, region, account, tags
- Time-series charts (daily, weekly, monthly trends)
- Comparison views (month-over-month, forecasting)
- Multi-account cost aggregation

### Alerts & Budgets
- Budget thresholds with notifications
- Anomaly detection alerts
- Email notifications via Resend

### Reports & Exports
- PDF report generation
- CSV data exports
- Scheduled report delivery

## Key Entities (Convex Schema)

### Core
- `organizations` - Multi-tenant organizations
- `orgMembers` - Membership with roles
- `users` - User accounts (linked to Better Auth)
- `subscriptions` - Stripe subscription data

### AWS Integration
- `awsAccounts` - Connected AWS accounts per organization
- `awsCredentials` - Encrypted credentials/role ARNs
- `sandboxExecutions` - Execution log (AI or manual)

### AI & Analysis
- `aiThreads` - Conversation threads per user/org (via Agent component)
- `aiMessages` - Message history (via Agent component)
- `analysisRuns` - Scheduled/on-demand analysis jobs
- `costSnapshots` - Aggregated cost data
- `resources` - AWS resource inventory
- `recommendations` - AI-generated savings recommendations

### Features
- `budgets` - Budget definitions per org/account
- `alerts` - Alert configurations and triggered history
- `reports` - Generated report records

## Pages Structure

| Route | Description |
|-------|-------------|
| `/` | Landing page with pricing |
| `/login`, `/signup` | Auth flows |
| `/chat` | **Primary UI**: AI assistant chat interface |
| `/dashboard` | Cost overview (AI-populated) |
| `/costs` | Detailed cost explorer |
| `/resources` | AWS resource inventory |
| `/recommendations` | Savings recommendations |
| `/terminal` | Manual AWS CLI execution |
| `/budgets` | Budget management |
| `/alerts` | Alert configuration |
| `/reports` | Report history |
| `/accounts` | AWS account connections |
| `/settings` | Organization settings |
| `/billing` | Stripe portal |
| `/team` | Team management |
| `/partner` | Partner multi-org dashboard |

## Project Structure

```
aws-optimizer/
├── apps/
│   ├── web/                      # React frontend
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       │   └── ai-assistant/ # Chat UI components
│   │       ├── stores/           # MobX stores
│   │       └── lib/
│   └── sandbox/                  # Cloudflare Container
│       ├── src/index.ts
│       ├── Dockerfile
│       └── wrangler.jsonc
├── packages/
│   └── convex/
│       ├── convex.config.ts      # Component registrations
│       ├── schema.ts
│       ├── ai/
│       │   ├── awsCostAgent.ts   # Main AI agent
│       │   ├── chat.ts           # Chat handlers
│       │   ├── threads.ts        # Thread management
│       │   └── tools/
│       │       ├── awsCommands.ts    # AWS CLI execution tools
│       │       ├── analysis.ts       # Cost analysis tools
│       │       ├── recommendations.ts # Savings tools
│       │       └── notifications.ts  # Alert/email tools
│       ├── organizations.ts
│       ├── awsAccounts.ts
│       ├── sandbox.ts            # Manual execution
│       └── crons.ts
└── package.json                  # Monorepo root
```

## Reference Files (from pruva-admin)

These files from `projects/pruva-admin` serve as implementation patterns:

- `convex/ai/contentOpsAgent.ts` - Agent configuration pattern
- `convex/ai/chat.ts` - Chat/streaming handlers
- `convex/ai/tools/contentRead.ts` - Tool definition pattern
- `convex/convex.config.ts` - Component registration
- `convex/schema.ts` - Schema patterns
- `convex/functions.ts` - Auth helpers pattern
- `convex/crons.ts` - Cron job patterns
- `src/main.tsx` - App bootstrap pattern
- `src/lib/theme.ts` - Mantine theme config
- `src/stores/RootStore.tsx` - MobX store pattern
- `src/pages/DashboardPage.tsx` - Dashboard UI pattern

## Reference Files (from POC)

- `poc/src/index.ts` - Sandbox worker implementation
- `poc/Dockerfile` - AWS CLI container setup
- `poc/wrangler.jsonc` - Container configuration

## Notes

### Security
- Credentials must be encrypted at rest; decrypted only for sandbox injection
- Agent has guardrails: confirmation before destructive actions, cost limits per run
- Partner isolation: Partners should never see other partners' customer data

### AI Agent
- AI agent is the **primary interface** - most users interact via chat
- Manual terminal is for power users and debugging
- Agent tools call sandbox worker for AWS CLI execution
- OpenRouter allows switching models per task (Claude for analysis, GPT-4 for summaries)

### Performance
- All sandbox calls go through rate limiter
- Rate limit sandbox executions to prevent AWS API throttling
- Consider caching frequently-run queries to reduce sandbox invocations
- Sandbox results should be parsed and stored in structured format for querying

### Convex Components
- Stripe component handles webhook signature verification automatically
- Rate Limiter should be applied to: sandbox execution, API endpoints, auth attempts
- Workpool enables priority queues: `high` for on-demand, `low` for scheduled jobs
- Action Retrier wraps external calls (sandbox API, AWS) for reliability
