# Cloutive CLI & AWS Optimizer Platform

A comprehensive AI-first SaaS platform for AWS cost analysis and optimization, plus a standalone CLI tool for generating AWS infrastructure reports.

---

## Table of Contents

- [Repository Structure](#repository-structure)
- [Top-Level CLI Tool (cloutive-cli)](#top-level-cli-tool-cloutive-cli)
- [AWS Optimizer Platform](#aws-optimizer-platform)
  - [Architecture](#architecture)
  - [Frontend (apps/web)](#frontend-appsweb)
  - [Sandbox Worker (apps/sandbox)](#sandbox-worker-appssandbox)
  - [Backend (packages/convex)](#backend-packagesconvex)
- [Database Schema](#database-schema)
- [AI Agent System](#ai-agent-system)
- [Authentication & Authorization](#authentication--authorization)
- [Billing & Subscriptions](#billing--subscriptions)
- [Cron & Scheduled Jobs](#cron--scheduled-jobs)
- [Development](#development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Key Patterns & Conventions](#key-patterns--conventions)
- [Navigation & Pages](#navigation--pages)
- [File Reference](#file-reference)
- [Production Environment](#production-environment)

---

## Repository Structure

```
cloutive-cli/                        # Root - standalone CLI tool (Bun)
├── src/                             # CLI source (Codebuff SDK integration)
├── package.json                     # Bun project, @codebuff/sdk + commander
├── docs/
│   ├── TEAMTODO.md                  # Shared task tracker for team & AI agents
│   ├── prod.txt                     # Production environment reference
│   ├── AWS_ANALYSIS_TEMPLATE.md     # Report template for CLI
│   └── perm_requirements.md         # Required AWS IAM permissions
├── aws-optimizer/                   # Main SaaS platform (npm workspaces monorepo)
│   ├── apps/
│   │   ├── web/                     # React frontend (Cloudflare Workers)
│   │   └── sandbox/                 # Isolated AWS CLI executor (CF Containers)
│   ├── packages/
│   │   └── convex/                  # Backend (Convex real-time DB + functions)
│   ├── scripts/
│   │   └── check-convex-sync.mjs   # Validates Convex schema sync
│   ├── package.json                 # Monorepo root (npm workspaces)
│   ├── tsconfig.json                # Root TypeScript config
│   ├── README.md                    # Platform-specific README
│   └── CONTRIBUTING.md              # Contribution guidelines
├── poc/                             # Proof-of-concept experiments
├── CLAUDE.md                        # Claude Code AI agent instructions
├── AGENTS.md                        # Multi-agent coordination
├── IDENTITY.md                      # Project identity & branding
└── PLAN.md                          # Current implementation plan
```

---

## Top-Level CLI Tool (cloutive-cli)

A Bun-based command-line tool that uses the **Codebuff AI SDK** to programmatically run AI agent conversations analyzing AWS infrastructure.

### Tech Stack
- **Runtime**: Bun (v1.0.0+)
- **AI SDK**: `@codebuff/sdk` - Codebuff AI agent platform
- **CLI Framework**: `commander` (argument parsing)
- **UI**: `chalk` (colors), `ora` (spinners)
- **Language**: TypeScript

### Commands

| Command | Description |
|---------|-------------|
| `bun run start check` | Verify prerequisites (CODEBUFF_API_KEY, AWS CLI) |
| `bun run start analyze --profile <p>` | Full AWS infrastructure analysis report |
| `bun run start snapshot --profile <p>` | Quick AWS system snapshot |

### How It Works
1. Validates prerequisites (API key, AWS CLI, profile)
2. Generates a detailed prompt for the AI agent
3. Runs the Codebuff SDK client (autonomous AI using `aws` CLI)
4. Produces a markdown report based on `docs/AWS_ANALYSIS_TEMPLATE.md`
5. Saves event traces and summaries to `logs/`

---

## AWS Optimizer Platform

The main product - an AI-powered SaaS for AWS cost optimization.

### Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AWS Optimizer Platform                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌────────────────────────────┐
│                  │     │                  │     │                            │
│   React SPA      │────▶│  Cloudflare      │────▶│     Convex Backend         │
│   (Mantine UI)   │     │  Worker (proxy)  │     │                            │
│                  │     │                  │     │  • Real-time Database      │
│  - TanStack      │     │  Routes:         │     │  • Better Auth             │
│    Router        │     │  /convex/* → CF   │     │  • AI Agent (@convex/agent)│
│  - MobX state   │     │  /api/auth/* →    │     │  • Stripe Billing          │
│  - Mantine v8   │     │    Convex site   │     │  • Resend Email            │
│                  │     │  /* → static     │     │  • Rate Limiting           │
└──────────────────┘     └────────┬─────────┘     │  • Action Retrier          │
                                  │               │  • Workpool                │
                                  │               └─────────────┬──────────────┘
                                  │                             │
                                  ▼                             ▼
                         ┌──────────────────┐     ┌────────────────────────────┐
                         │                  │     │                            │
                         │    Sandbox       │◀────│  AI Agent calls sandbox    │
                         │    Worker        │     │  to execute AWS commands   │
                         │                  │     │                            │
                         │  ┌────────────┐  │     └────────────────────────────┘
                         │  │  Container │  │
                         │  │  (AWS CLI) │  │
                         │  └────────────┘  │
                         │                  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │                  │
                         │  Customer's AWS  │
                         │  Account         │
                         │  (read-only)     │
                         │                  │
                         └──────────────────┘
```

### Data Flow

1. **User interacts** with React SPA (chat, dashboard, reports, etc.)
2. **Cloudflare Worker** routes requests:
   - `/convex/*` → Convex Cloud (queries, mutations, WebSocket sync)
   - `/api/auth/*` → Convex Site (Better Auth HTTP actions)
   - `/.well-known/*` → Convex Site (JWKS/OpenID discovery)
   - Everything else → Static SPA assets
3. **Convex Backend** processes business logic, stores data in real-time DB
4. **AI Agent** (triggered via chat or cron) calls sandbox to execute AWS commands
5. **Sandbox Worker** runs AWS CLI in isolated Cloudflare Container with injected credentials
6. **Results** flow back: sandbox → Convex (stored) → frontend (real-time via WebSocket)

---

### Frontend (apps/web)

**Technology**: React 19 + Vite 7 + Mantine v8 + TanStack Router + MobX

#### Key Dependencies
| Package | Purpose |
|---------|---------|
| `react` 19 + `react-dom` 19 | UI framework |
| `@mantine/core` v8 | Component library (buttons, inputs, tables, modals) |
| `@mantine/charts` | Chart components (via Recharts) |
| `@mantine/notifications` | Toast notifications |
| `@mantine/form` | Form state management |
| `@mantine/hooks` | React utility hooks |
| `@tanstack/react-router` | File-based routing |
| `mobx` + `mobx-react-lite` | Reactive state management |
| `convex` (react client) | Real-time data sync with backend |
| `better-auth` (react client) | Authentication (email/password + orgs) |
| `@react-pdf/renderer` | PDF report generation |
| `recharts` | Charting library |
| `dayjs` | Date manipulation |
| `marked` | Markdown rendering |
| `diff` | Text diffing (for prompt version comparison) |

#### Source Structure
```
apps/web/src/
├── main.tsx                 # App entry point
├── worker.ts               # Cloudflare Worker (proxy to Convex)
├── router.tsx              # TanStack Router route definitions
├── App.css / index.css     # Global styles
├── vite-env.d.ts           # Vite type declarations
├── components/
│   ├── AppShell.tsx        # Main layout with sidebar navigation
│   ├── nav-items.tsx       # Navigation item definitions
│   ├── OrganizationSwitcher.tsx  # Org context switcher
│   ├── CopyAiPromptButton.tsx    # Copy AI prompt to clipboard
│   ├── CostAnalysisReportPdf.tsx # PDF report component
│   ├── ReportPdfDocument.tsx     # PDF document wrapper
│   ├── FeedbackButton.tsx        # Bug report/feedback widget
│   ├── pdf/                # PDF rendering components
│   ├── prompts/            # AI prompt UI components
│   └── ui/                 # Reusable UI components
├── pages/
│   ├── LandingPage.tsx     # Public landing / marketing page
│   ├── LoginPage.tsx       # Email/password login
│   ├── SignupPage.tsx       # User registration
│   ├── ForgotPasswordPage.tsx  # Password reset
│   ├── AcceptInvitationPage.tsx  # Org invitation acceptance
│   ├── DashboardPage.tsx   # Main dashboard (costs overview)
│   ├── ChatPage.tsx        # AI chat interface
│   ├── CostExplorerPage.tsx  # Cost breakdown & explorer
│   ├── ResourcesPage.tsx   # AWS resource inventory
│   ├── RecommendationsPage.tsx  # Cost optimization recommendations
│   ├── TerminalPage.tsx    # Direct AWS CLI terminal
│   ├── BudgetsPage.tsx     # Budget management
│   ├── AlertsPage.tsx      # Alert notifications
│   ├── ReportsPage.tsx     # Generated reports (view/generate/PDF)
│   ├── AccountsPage.tsx    # AWS account connections
│   ├── SettingsPage.tsx    # Organization settings
│   ├── ActivityPage.tsx    # Audit log / activity history
│   ├── BillingPage.tsx     # Subscription & billing management
│   ├── TeamPage.tsx        # Team members & invitations
│   ├── PartnerPage.tsx     # Partner portal (client org management)
│   ├── FeedbackAdminPage.tsx  # Admin view for bug reports
│   ├── CronManagementPage.tsx # Cron job scheduling UI
│   ├── AIPromptsPage.tsx   # AI prompt configuration/versioning
│   ├── PrivacyPolicyPage.tsx  # Static legal pages
│   └── TermsOfServicePage.tsx # Static legal pages
├── stores/
│   ├── RootStore.tsx       # Central MobX store container (singleton)
│   ├── OrganizationStore.ts  # Active organization state
│   ├── StoreContext.ts     # React context for stores
│   ├── StoreProvider.tsx   # Provider component
│   ├── useStores.ts        # Hook to access stores
│   └── index.ts            # Store exports
├── hooks/
│   ├── index.ts            # Hook exports
│   ├── useActiveOrganization.ts  # Get current org from Better Auth
│   ├── useOrganization.ts  # Organization data hook
│   └── useOrganizationInit.ts  # Initialize org on first load
└── lib/
    ├── auth-client.ts      # Better Auth client setup (email/password + org plugin)
    ├── convex.tsx          # ConvexProvider with auth token injection
    ├── credentials-parser.ts  # Parse AWS credentials files (INI/JSON/ENV)
    ├── notifications.ts    # Notification utility functions
    └── theme.ts            # Mantine theme customization
```

#### Cloudflare Worker (Proxy)
The frontend is deployed as a Cloudflare Worker that:
- Serves the built SPA as static assets
- Proxies `/convex/*` to Convex Cloud (HTTP API + WebSocket)
- Proxies `/api/auth/*` to Convex Site (Better Auth HTTP handlers)
- Rewrites `/.well-known/*` to `/api/auth/.well-known/*` for JWKS discovery
- Has observability (logs + traces) enabled
- Supports SPA routing via `not_found_handling: "single-page-application"`

#### State Management Pattern
- **MobX RootStore**: Singleton store container accessed via React context
- **OrganizationStore**: Tracks active organization ID and related state
- **Convex real-time queries**: Components subscribe directly to Convex queries for live data
- **Better Auth session**: Authentication state managed by Better Auth react client

#### Routing
Two layout groups in TanStack Router:
1. **Auth layout** (no sidebar): `/`, `/login`, `/signup`, `/forgot-password`, `/accept-invitation/$invitationId`
2. **App layout** (with sidebar): All authenticated pages (`/dashboard`, `/chat`, `/costs`, etc.)

---

### Sandbox Worker (apps/sandbox)

**Technology**: Cloudflare Workers + Cloudflare Containers + AWS CLI

The sandbox provides isolated, secure AWS CLI execution:

#### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check - verifies AWS CLI is available in container |
| `/execute` | POST | Execute an AWS CLI command with provided credentials |

#### `/execute` Request Format
```json
{
  "command": "aws ec2 describe-instances --region us-east-1",
  "credentials": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "sessionToken": "...",      // optional (for temporary creds)
    "region": "us-east-1"       // optional (default: us-east-1)
  }
}
```

#### `/execute` Response Format
```json
{
  "success": true,
  "stdout": "{...}",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 1234
}
```

#### Security Controls
- Only commands starting with `aws ` are allowed (enforced server-side)
- Credentials are injected per-request into the container filesystem
- Container is isolated - no persistent state between requests
- CORS headers for cross-origin development

#### How It Works
1. Receives POST with command + credentials
2. Writes AWS credentials to `/root/.aws/credentials` and `/root/.aws/config` inside the container
3. Executes the command via `sandbox.exec()`
4. Returns stdout/stderr/exitCode/timing
5. Container is managed as a Durable Object (`@cloudflare/sandbox`)

---

### Backend (packages/convex)

**Technology**: Convex (real-time serverless backend)

#### Convex Components (convex.config.ts)
| Component | Package | Purpose |
|-----------|---------|---------|
| `rateLimiter` | `@convex-dev/rate-limiter` | Rate limiting for API endpoints |
| `resend` | `@convex-dev/resend` | Email sending via Resend |
| `agent` | `@convex-dev/agent` | AI agent framework (threads, tools, memory) |
| `workpool` | `@convex-dev/workpool` | Job queue with priority |
| `actionRetrier` | `@convex-dev/action-retrier` | Retry failed external calls |
| `stripe` | `@convex-dev/stripe` | Stripe billing webhooks |
| `betterAuth` | `@convex-dev/better-auth` | Authentication (Better Auth adapter) |
| `feedback` | `@fatagnus/convex-feedback` | Bug reports & feedback system |

#### HTTP Routes (http.ts)
- Better Auth routes (sign-in, sign-up, session management) with CORS
- Feedback REST API at `/feedback/*`
- Stripe webhook routes (ready to enable)

#### Backend File Reference
```
packages/convex/convex/
├── _generated/             # Auto-generated by Convex (API types, server helpers)
├── ai/
│   ├── index.ts           # AI module exports
│   ├── awsCostAgent.ts    # Main AI agent definition (model, tools, instructions)
│   ├── chat.ts            # Chat message handlers (send, stream, generate)
│   ├── threads.ts         # Thread CRUD (create, list, get, remove)
│   ├── mutations.ts       # AI-related mutations
│   ├── reportGeneration.ts  # Report generation via AI
│   ├── costAnalysisData.ts     # Cost data gathering for reports
│   ├── costAnalysisInsights.ts # Insight generation from cost data
│   ├── costAnalysisReport.ts   # Full report assembly
│   ├── costAnalysisTypes.ts    # Type definitions for cost analysis
│   └── tools/
│       ├── awsCommands.ts  # AI tools: aws_listAccounts, aws_executeCommand, aws_getCostData, aws_listResources, aws_getReservations
│       ├── analysis.ts     # AI tools: analysis_saveCostSnapshot, analysis_saveResource, recommendation_save, analysis_generateReport
│       └── notifications.ts # AI tools: notification_send, analysis_createAlert
├── betterAuth/            # Better Auth schema and config
├── migrations/
│   └── seedReportPrompts.ts  # Seed default AI prompt templates
├── schema.ts              # Full database schema (all tables + validators)
├── auth.ts                # Better Auth configuration (email/password + org plugin)
├── auth.config.ts         # Auth config for route setup
├── authHelpers.ts         # getUserOrgId and membership helpers
├── functions.ts           # Auth utility functions (requireAuth, requireRole, requireWriteAccess, etc.)
├── http.ts                # HTTP router (auth routes, feedback, stripe)
├── convex.config.ts       # Component registration
├── organizations.ts       # Organization CRUD (Better Auth ↔ Convex mapping)
├── awsAccounts.ts         # AWS account CRUD + connection management
├── awsOrganizations.ts    # AWS Organizations discovery (multi-account import)
├── sandbox.ts             # Sandbox action (credential decrypt → call sandbox worker → log result)
├── costs.ts               # Cost data queries (transform snapshots → records)
├── resources.ts           # Resource inventory queries
├── recommendations.ts     # Recommendation CRUD
├── budgets.ts             # Budget CRUD + threshold tracking
├── alerts.ts              # Alert management
├── reports.ts             # Report CRUD + generation tracking
├── billing.ts             # Billing/usage queries
├── stripe.ts              # Stripe integration (plan tiers, subscriptions, webhooks)
├── dashboard.ts           # Dashboard aggregate queries
├── activityLogging.ts     # Activity log helpers
├── activityLogs.ts        # Activity log queries
├── cronManager.ts         # Table-driven cron scheduler + dispatcher
├── crons.ts               # Cron job handlers (cost collection, expiry check, weekly emails)
├── cronUtils.ts           # Cron expression parsing utilities
├── credentialExpiry.test.ts  # Credential expiry tests
├── credentialValidation.test.ts  # Credential validation tests
├── feedback.ts            # Feedback/bug report handlers
├── organizationEmails.ts  # Org invitation email sending (via Resend)
├── partner.ts             # Partner management (create client orgs, invite clients)
├── rateLimit.ts           # Rate limiter configuration
├── reportPrompts.ts       # AI prompt CRUD (system + org-level overrides)
├── reportPromptVersions.ts # Prompt version history
├── seed.ts                # Database seeding
└── test.helpers.ts        # Test utilities
```

---

## Database Schema

The Convex schema (`packages/convex/convex/schema.ts`) defines these tables:

### Core Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant organizations (name, slug, plan, settings, betterAuthOrgId) |
| `orgMembers` | User ↔ Organization membership with roles (owner/admin/member/viewer) |
| `orgInvitations` | Pending invitations to join organizations |
| `users` | User accounts (email, name, role: admin/user, status: active/inactive/pending) |

### AWS Tables

| Table | Purpose |
|-------|---------|
| `awsAccounts` | Connected AWS accounts (name, accountNumber, connectionType, status) |
| `awsCredentials` | Encrypted credentials (access keys, IAM roles, SSO, OIDC configs) |
| `sandboxExecutions` | Execution logs for AWS CLI commands (command, stdout, stderr, exitCode, timing) |
| `awsOrgDiscoveries` | AWS Organizations discovery sessions (multi-account import) |
| `discoveredAwsAccounts` | Member accounts found via AWS Organizations |

### Analysis Tables

| Table | Purpose |
|-------|---------|
| `analysisRuns` | AI analysis run tracking (type, status, timing) |
| `costSnapshots` | Daily cost data (totalCost, serviceBreakdown, regionBreakdown by date) |
| `resources` | Discovered AWS resources (type, ID, name, region, tags, monthlyCost) |
| `recommendations` | Optimization recommendations (type, savings estimate, status) |

### Billing & Reports

| Table | Purpose |
|-------|---------|
| `subscriptions` | Stripe subscriptions (customerId, planId, status, periodEnd) |
| `usageRecords` | Usage tracking for billing (analysis runs, API calls) |
| `budgets` | Cost budgets (amount, period, alertThresholds) |
| `alerts` | System alerts (type, severity, triggered/acknowledged timestamps) |
| `reports` | Generated reports (type, status, content markdown, reportData JSON, progress) |

### System Tables

| Table | Purpose |
|-------|---------|
| `activityLogs` | Audit trail (who did what to which entity) |
| `cronSchedules` | Table-driven cron jobs (expression, handler, enabled, lastRun) |
| `cronExecutionLog` | Cron execution history (status, duration, errors) |
| `reportPrompts` | Configurable AI prompts (system defaults + org overrides) |
| `reportPromptVersions` | Version history for prompt changes |

### Connection Types (awsCredentials)
- **access_key**: Direct AWS access key + secret
- **iam_role**: Cross-account IAM role assumption (roleArn + externalId)
- **sso**: AWS SSO/Identity Center (startUrl, region, accountId, roleName)
- **oidc**: OIDC/Web Identity federation (providerArn, roleArn, audience)
- **credentials_file**: Uploaded credentials file (parsed on upload)

### Subscription Plans
| Plan | Max Accounts | Analysis Runs/mo | Overage |
|------|-------------|-----------------|---------|
| Free | 1 | 5 | N/A |
| Starter/Professional | 5 | 100 | $0.25/run |
| Enterprise | Unlimited | Unlimited | N/A |

---

## AI Agent System

### Agent Configuration
- **Framework**: `@convex-dev/agent` (Convex-native agent framework)
- **Model**: `anthropic/claude-sonnet-4` via OpenRouter
- **Max Steps**: 100 per conversation
- **Conversations**: Thread-based (create, list, get, remove)

### Agent Tools

#### AWS Command Tools (awsCommands.ts)
| Tool | Description |
|------|-------------|
| `aws_listAccounts` | List connected AWS accounts for org |
| `aws_executeCommand` | Execute arbitrary `aws` CLI command via sandbox |
| `aws_getCostData` | Query AWS Cost Explorer for spending data |
| `aws_listResources` | List EC2, RDS, S3, Lambda resources |
| `aws_getReservations` | Get Reserved Instance and Savings Plan data |

#### Analysis Tools (analysis.ts)
| Tool | Description |
|------|-------------|
| `analysis_saveCostSnapshot` | Persist cost data to costSnapshots table |
| `analysis_saveResource` | Persist discovered resource to resources table |
| `recommendation_save` | Persist optimization recommendation |
| `analysis_generateReport` | Create a report record |

#### Notification Tools (notifications.ts)
| Tool | Description |
|------|-------------|
| `notification_send` | Send a notification to a user |
| `analysis_createAlert` | Create a system alert |

### Chat System
- `sendMessage` — Send user message to AI thread
- `generateResponse` — Generate AI response (non-streaming)
- `streamMessage` — Stream AI response in real-time
- `listThreadMessages` — Get messages in a thread

### Report Generation Flow
1. User triggers report from UI (or cron schedule)
2. `reportGeneration.ts` creates a report record (status: "pending")
3. AI agent gathers cost data via `costAnalysisData.ts`
4. Agent generates insights via `costAnalysisInsights.ts`
5. `costAnalysisReport.ts` assembles the final report
6. Report record updated (status: "completed", content: markdown, reportData: JSON)
7. Progress tracked in real-time (progressStep, progressMessage, progressPercent)

---

## Authentication & Authorization

### Stack
- **Frontend**: `better-auth` React client with `convexClient`, `adminClient`, `organizationClient` plugins
- **Backend**: `@convex-dev/better-auth` component with `organization` and `admin` plugins
- **Secret**: `BETTER_AUTH_SECRET` environment variable (must match across deployments)

### Auth Flow
1. Frontend `auth-client.ts` creates Better Auth client
2. User signs up/in via email+password (or organization invite)
3. Better Auth issues session tokens
4. Frontend Convex client requests token from Better Auth's `convex` plugin
5. Token injected into Convex queries/mutations for server-side auth
6. Backend `functions.ts` provides `requireAuth()`, `requireRole()`, `requireWriteAccess()`, `requirePublishAccess()`

### Role Hierarchy

#### App-Level Roles (users table)
| Role | Access |
|------|--------|
| `admin` | Platform admin - full access, can publish/deploy |
| `user` | Regular user - read/write access |

#### Organization Roles (orgMembers table)
| Role | Access |
|------|--------|
| `owner` | Full access, billing, can delete org |
| `admin` | Full access except billing/deletion |
| `member` | Can view and create resources |
| `viewer` | Read-only access |

### Test Mode
Set `TEST_MODE=true` (backend) and `VITE_TEST_MODE=true` (frontend) to bypass authentication. Configurable test user via `TEST_USER_EMAIL`, `TEST_USER_NAME`, `TEST_USER_ROLE` env vars.

---

## Billing & Subscriptions

### Stripe Integration (`stripe.ts`)
- Plan tiers: Free → Starter → Professional → Enterprise
- Customer management (create/update Stripe customers)
- Subscription lifecycle (active, canceled, past_due, trialing, incomplete)
- Usage-based billing for AI analysis runs (overage charges)
- Webhook handlers for subscription events (via `@convex-dev/stripe`)

### Usage Tracking (`usageRecords` table)
- Tracks `analysis_run` and `api_call` types per billing period
- Enforces plan limits before allowing new analysis runs

---

## Cron & Scheduled Jobs

### Architecture (cronManager.ts)
Instead of static `cronJobs()`, uses a **table-driven** approach:
1. A single static cron ticks every 5 minutes
2. The tick reads `cronSchedules` table
3. For each enabled schedule where `nextRunAt <= now`, dispatches the handler
4. Logs execution to `cronExecutionLog`
5. Full CRUD from the UI (CronManagementPage)

### Registered Handlers
| Handler Key | Function | Description |
|-------------|----------|-------------|
| `triggerDailyCostCollection` | `internal.crons.triggerDailyCostCollection` | Collect daily cost data for all accounts |
| `triggerCredentialExpiryCheck` | `internal.crons.triggerCredentialExpiryCheck` | Check for expiring AWS credentials |
| `triggerWeeklySummaryEmails` | `internal.crons.triggerWeeklySummaryEmails` | Send weekly cost summary emails |

---

## Development

### Prerequisites
- **Node.js 20+** (for npm workspaces)
- **Bun 1.0+** (for root CLI tool)
- **Docker** (for sandbox local development)
- **Convex CLI**: `npm install -g convex`
- **Wrangler CLI**: `npm install -g wrangler` (Cloudflare Workers)

### Quick Start
```bash
# Install dependencies (from aws-optimizer/)
cd aws-optimizer
npm install

# Start all services (Convex + Web)
npm run dev

# Start individually:
npm run dev:convex    # Convex backend (syncs schema, runs functions)
npm run dev:web       # React frontend at http://localhost:5173
npm run dev:sandbox   # Sandbox worker (requires Docker)

# For the root CLI tool:
cd ..  # back to cloutive-cli/
bun install
bun run start check
```

### Local Environment Files (not in git)
```
aws-optimizer/packages/convex/.env.local   → CONVEX_DEPLOYMENT=dev:quirky-sparrow-76
                                              CONVEX_URL=https://quirky-sparrow-76.convex.cloud
aws-optimizer/apps/web/.env.local          → VITE_CONVEX_URL=https://quirky-sparrow-76.convex.cloud
```

### Monorepo Scripts (from aws-optimizer/)
| Script | Command | Description |
|--------|---------|-------------|
| Dev all | `npm run dev` | Starts Convex + Web concurrently |
| Dev web | `npm run dev:web` | Vite dev server only |
| Dev convex | `npm run dev:convex` | Convex dev only |
| Dev sandbox | `npm run dev:sandbox` | Sandbox worker (needs Docker) |
| Build all | `npm run build` | Build all workspaces |
| Lint all | `npm run lint` | ESLint across workspaces |
| Typecheck all | `npm run typecheck` | TypeScript check across workspaces |
| Check Convex sync | `npm run check:convex` | Validate Convex schema is in sync |

---

## Deployment

### Frontend (apps/web)
```bash
cd aws-optimizer/apps/web

# Login to Cloudflare (first time)
npx wrangler login

# Deploy staging
./deploy.sh staging
# or: npm run deploy:staging

# Deploy production
./deploy.sh production
# or: npm run deploy:production
```

**Deploy script** (`deploy.sh`) does:
1. Validate environment (staging/production)
2. Check wrangler CLI is installed and authenticated
3. Run linting (`npm run lint`)
4. Build frontend (`npm run build` → Vite produces `dist/`)
5. Deploy via `wrangler deploy --env <ENV>`
6. Output deployment summary

**Wrangler config** (`wrangler.jsonc`):
- Worker name: `aws-optimizer-web` (staging: `-staging`, production: `-prod`)
- Entry: `./src/worker.ts`
- Assets from `./dist` with SPA fallback
- Environment variable `VITE_CONVEX_URL` set per environment
- Observability: logs + traces enabled

### Sandbox Worker (apps/sandbox)
```bash
cd aws-optimizer/apps/sandbox
./deploy.sh staging
./deploy.sh production
```

Requires Cloudflare Containers to be enabled on the account (Workers Paid plan).

### Convex Backend
```bash
cd aws-optimizer/packages/convex

# Development (live sync)
npx convex dev

# Production deploy
npx convex deploy

# Set environment variables
npx convex env set OPENROUTER_API_KEY "sk-or-..."
npx convex env set BETTER_AUTH_SECRET "..."
npx convex env set SANDBOX_WORKER_URL "https://..."
npx convex env set SITE_URL "https://..."
```

---

## Environment Variables

### Convex Backend (set via `npx convex env set`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI agent (Claude Sonnet) |
| `BETTER_AUTH_SECRET` | Yes | Secret for Better Auth JWT signing |
| `SANDBOX_WORKER_URL` | Yes | URL of deployed sandbox worker |
| `SITE_URL` | Yes | Base URL of the web app (for auth redirects) |
| `RESEND_API_KEY` | Yes | Resend API key for transactional emails |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for credential encryption |
| `TEST_MODE` | No | Set `true` to bypass authentication |
| `TEST_USER_EMAIL` | No | Test user email (default: test@example.com) |
| `TEST_USER_NAME` | No | Test user name (default: Test User) |
| `TEST_USER_ROLE` | No | Test user role: admin/user (default: admin) |

### Frontend (apps/web/.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_TEST_MODE` | No | Set `true` for frontend test mode |

### Root CLI (cloutive-cli)

| Variable | Required | Description |
|----------|----------|-------------|
| `CODEBUFF_API_KEY` | Yes | Codebuff API key from codebuff.com |

---

## Testing

### Running Tests
```bash
# All workspaces
cd aws-optimizer && npm test --workspaces

# Specific workspace
npm test --workspace=packages/convex
npm test --workspace=apps/web
npm test --workspace=apps/sandbox

# Watch mode
npm run test:watch --workspace=packages/convex

# Root CLI
cd .. && bun test
```

### Test Stack
| Layer | Framework | Tools |
|-------|-----------|-------|
| Backend (Convex) | Vitest + `convex-test` | In-memory Convex runtime |
| Frontend (React) | Vitest + Testing Library + jsdom | Component rendering, DOM queries |
| Sandbox Worker | Vitest | Unit tests for request handling |
| CLI | Bun test | Bun's built-in test runner |

### Test Mode
The application supports a `TEST_MODE` where:
- Backend: `requireAuth()` returns a mock user instead of checking session
- Frontend: Auth UI is bypassed, shows test user info
- Useful for development without running full auth flow

---

## Key Patterns & Conventions

### TypeScript
- TypeScript everywhere (strict mode)
- `interface` for object shapes, `type` for unions/aliases
- No `any` types — use proper typing
- Export types when reused across modules

### React / Frontend
- Functional components with hooks only
- Mantine v8 components for all UI
- MobX for local/shared state, Convex queries for server state
- TanStack Router for routing (type-safe)
- Colocate component styles

### Convex / Backend
- `requireAuth()` / `requireWriteAccess()` / `requirePublishAccess()` for auth checks
- Always check org membership before data access
- `logActivity()` for audit trail
- Rate limiting on public endpoints
- Action retrier for external API calls (sandbox, stripe, resend)

### Naming
- Components: `PascalCase.tsx` (e.g., `DashboardPage.tsx`)
- Functions/modules: `camelCase.ts` (e.g., `organizations.ts`)
- Tests: `*.test.ts` or `*.test.tsx` (colocated)
- Types: Colocated with implementation or in shared `types.ts`

### Commits
Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

### Security
- AWS credentials encrypted at rest, decrypted only for sandbox injection
- Sandbox only allows `aws ` prefixed commands
- No credential logging
- CORS configured for development
- Rate limiting on public/external endpoints
- Row-level security via org membership checks

---

## Navigation & Pages

All pages accessible from the sidebar (in order):

| Page | Route | Description |
|------|-------|-------------|
| Chat | `/chat` | AI chat interface for conversational AWS analysis |
| Dashboard | `/dashboard` | Cost overview, trends, top services, account summary |
| Costs | `/costs` | Cost Explorer - breakdown by service/region/date |
| Resources | `/resources` | AWS resource inventory (EC2, RDS, S3, Lambda, etc.) |
| Recommendations | `/recommendations` | AI-generated cost optimization recommendations |
| Terminal | `/terminal` | Direct AWS CLI command execution |
| Budgets | `/budgets` | Budget creation and threshold tracking |
| Alerts | `/alerts` | Alert notifications (budget exceeded, anomalies, etc.) |
| Reports | `/reports` | Generate/view/download cost analysis reports (PDF) |
| Accounts | `/accounts` | AWS account connections (add/remove/validate) |
| Settings | `/settings` | Organization settings and preferences |
| Activity | `/settings/activity` | Audit log of all actions |
| Billing | `/billing` | Subscription plans, usage, payment methods |
| Team | `/team` | Team members, roles, invitations |
| Feedback | `/feedback-admin` | Admin view of user bug reports/feature requests |
| Cron Jobs | `/cron-management` | Schedule management (enable/disable/trigger/logs) |
| AI Prompts | `/settings/prompts` | Configure AI report prompts with version history |

---

## File Reference

### Critical Files to Understand

| File | Why It Matters |
|------|---------------|
| `aws-optimizer/packages/convex/convex/schema.ts` | Complete database schema - all tables, indexes, validators |
| `aws-optimizer/packages/convex/convex/functions.ts` | Auth helpers used by every backend function |
| `aws-optimizer/packages/convex/convex/ai/awsCostAgent.ts` | AI agent definition (model, tools, system prompt) |
| `aws-optimizer/packages/convex/convex/sandbox.ts` | Bridge between Convex and sandbox worker |
| `aws-optimizer/apps/web/src/router.tsx` | All frontend routes |
| `aws-optimizer/apps/web/src/worker.ts` | Cloudflare Worker proxy logic |
| `aws-optimizer/apps/web/src/lib/auth-client.ts` | Frontend auth setup |
| `aws-optimizer/apps/web/src/lib/convex.tsx` | Convex client + auth token provider |
| `aws-optimizer/apps/sandbox/src/index.ts` | Complete sandbox worker implementation |
| `aws-optimizer/package.json` | Monorepo workspace configuration |

### Adding a New Feature Checklist

1. **Schema** — Add table/fields in `schema.ts`
2. **Backend** — Create queries/mutations in new or existing `.ts` file
3. **AI Tools** (if applicable) — Add tool in `ai/tools/`, register in agent
4. **Frontend Page** — Create `PageName.tsx` in `src/pages/`
5. **Route** — Add route in `src/router.tsx`
6. **Navigation** — Add nav item in `src/components/nav-items.tsx`
7. **Store** (if complex state) — Add MobX store in `src/stores/`
8. **Tests** — Backend: `convex-test`, Frontend: Testing Library
9. **Deploy** — `npx convex deploy` (backend), `./deploy.sh staging` (frontend)

---

## Production Environment

### Cloudflare
- **Account**: probeousdidontas@gmail.com (ID: `2a26d1b3a67caf28bbc40438ebf370d7`)
- **Staging**: `aws-optimizer-web-staging.probeousdidontas.workers.dev`
- **Production**: `aws-optimizer-web-prod.probeousdidontas.workers.dev` (not yet deployed)
- **Sandbox**: `aws-optimizer-sandbox-staging.probeousdidontas.workers.dev` (not yet deployed on new account)

### Convex
- **Team**: probeousdidontas
- **Project**: cloutive
- **Deployment**: `dev:quirky-sparrow-76`
- **URL**: `https://quirky-sparrow-76.convex.cloud`
- **Site URL**: `https://quirky-sparrow-76.convex.site`

### Shared Dev Box
- **Host**: `ozant@100.119.161.97`
- **Workspace**: `/Users/ozant/oc-workspace-cloutiveassistantbot`
- **Status**: Wrangler + Convex auth configured, ready to deploy

### Deploy Commands (Quick Reference)
```bash
# Staging frontend
cd aws-optimizer/apps/web && ./deploy.sh staging

# Production frontend
cd aws-optimizer/apps/web && ./deploy.sh production

# Convex development
cd aws-optimizer/packages/convex && npx convex dev

# Convex production
cd aws-optimizer/packages/convex && npx convex deploy
```

---

## License

Proprietary - All rights reserved.
