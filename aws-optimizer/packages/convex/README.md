# AWS Optimizer Convex Backend

Serverless backend powered by Convex with real-time database, authentication, and AI agent capabilities.

## Tech Stack

- **Convex** - Real-time database and serverless functions
- **@convex-dev/agent** - AI agent framework with tool calling
- **@convex-dev/better-auth** - Authentication integration
- **@convex-dev/stripe** - Stripe billing integration
- **@convex-dev/resend** - Email sending
- **@convex-dev/rate-limiter** - Rate limiting
- **OpenRouter** - AI model provider (GPT-4, Claude, etc.)

## Project Structure

```
convex/
├── ai/                   # AI Agent
│   ├── awsCostAgent.ts   # Main agent configuration
│   ├── chat.ts           # Chat/thread management
│   ├── threads.ts        # Thread CRUD operations
│   ├── mutations.ts      # Agent tool implementations
│   └── tools/            # Agent tools
│       ├── awsCommands.ts    # AWS CLI execution tools
│       ├── analysis.ts       # Analysis/reporting tools
│       └── notifications.ts  # Notification tools
├── betterAuth/           # Auth schema extension
│   └── schema.ts
├── _generated/           # Auto-generated Convex code
├── schema.ts             # Database schema
├── functions.ts          # Auth helpers and middleware
├── auth.ts               # Better Auth configuration
├── http.ts               # HTTP endpoints
├── organizations.ts      # Organization management
├── orgMembers.ts         # Member management
├── awsAccounts.ts        # AWS account connection
├── sandbox.ts            # Sandbox execution
├── stripe.ts             # Billing and subscriptions
├── dashboard.ts          # Dashboard data
├── crons.ts              # Scheduled jobs
├── activityLogs.ts       # Activity logging
├── rateLimit.ts          # Rate limiting
└── *.test.ts             # Test files
```

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `organizations` | Multi-tenant organizations |
| `orgMembers` | Organization membership |
| `orgInvitations` | Pending invitations |
| `awsAccounts` | Connected AWS accounts |
| `awsCredentials` | Encrypted AWS credentials |
| `subscriptions` | Stripe subscriptions |

### Analysis Tables

| Table | Description |
|-------|-------------|
| `analysisRuns` | Analysis job tracking |
| `costSnapshots` | Point-in-time cost data |
| `resources` | Discovered AWS resources |
| `recommendations` | Cost optimization suggestions |
| `reports` | Generated analysis reports |

### AI Tables

| Table | Description |
|-------|-------------|
| `threads` | AI chat threads |
| `messages` | Chat messages |

### Supporting Tables

| Table | Description |
|-------|-------------|
| `activityLogs` | Audit trail |
| `budgets` | Budget thresholds |
| `alerts` | Alert configurations |
| `sandboxExecutions` | Command execution logs |

## Development

### Prerequisites

- Node.js 20+
- Convex CLI (`npm install -g convex`)

### Setup

```bash
# Install dependencies (from monorepo root)
npm install

# Login to Convex
npx convex login

# Start development server
npm run dev
```

### Environment Variables

Set using `npx convex env set <NAME> <VALUE>`:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook secret |
| `SANDBOX_URL` | Yes | Sandbox worker URL |
| `ENCRYPTION_KEY` | Yes | 32-byte hex encryption key |
| `SITE_URL` | Yes | Web app base URL |

Generate an encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test file
npm test -- organizations.test.ts
```

Tests use `convex-test` for testing Convex functions without a live backend.

### Type Checking

```bash
npm run typecheck
```

## AI Agent

The AWS Cost Agent uses `@convex-dev/agent` to autonomously analyze AWS infrastructure.

### Configuration

```typescript
// ai/awsCostAgent.ts
export const awsCostAgent = createAgent({
  model: openrouter('anthropic/claude-sonnet-4'),
  tools: [
    ...AWS_COMMAND_TOOLS,
    ...ANALYSIS_TOOLS,
    ...NOTIFICATION_TOOLS,
  ],
  systemPrompt: "...",
});
```

### Available Tools

| Tool | Description |
|------|-------------|
| `aws_executeCommand` | Execute AWS CLI command |
| `aws_getCostData` | Get cost and usage data |
| `aws_listResources` | List AWS resources |
| `aws_getReservations` | Get RI/SP data |
| `analysis_saveCostSnapshot` | Save cost snapshot |
| `analysis_saveResource` | Save discovered resource |
| `recommendation_save` | Save recommendation |
| `analysis_generateReport` | Generate analysis report |
| `notification_send` | Send notification |
| `analysis_createAlert` | Create cost alert |

## Deployment

```bash
# Deploy to production
npx convex deploy

# Set production environment variables
npx convex env set OPENROUTER_API_KEY "sk-or-..." --prod
npx convex env set RESEND_API_KEY "re_..." --prod
# ... set all required variables
```

## Cron Jobs

Scheduled jobs defined in `crons.ts`:

| Job | Schedule | Description |
|-----|----------|-------------|
| `triggerDailyCostCollection` | Daily 6 AM UTC | Collect cost data |
| `triggerWeeklySummaryEmails` | Monday 8 AM UTC | Send weekly summaries |

## Rate Limiting

Rate limits configured in `rateLimit.ts`:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 5 | 1 minute |
| Analysis | 10 | 1 hour |
| API (general) | 100 | 1 minute |
| Sandbox | 30 | 1 minute |

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Convex dev server |
| `npm run deploy` | Deploy to production |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
