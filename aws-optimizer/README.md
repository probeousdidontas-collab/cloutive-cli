# AWS Manager

An AI-first SaaS platform for AWS cost analysis and optimization. Connect your AWS accounts and let our AI agent analyze your infrastructure, identify cost-saving opportunities, and generate actionable recommendations.

## Features

- 🤖 **AI-Powered Analysis** - Autonomous agent executes AWS CLI commands and analyzes your infrastructure
- 💰 **Cost Optimization** - Identifies unused resources, rightsizing opportunities, and Reserved Instance recommendations
- 📊 **Real-time Dashboard** - Live cost tracking and trend visualization
- 🔒 **Secure Execution** - AWS commands run in isolated Cloudflare Containers
- 👥 **Team Collaboration** - Multi-user organizations with role-based access
- 📧 **Automated Reports** - Weekly cost summaries delivered to your inbox

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Manager                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│                 │     │                 │     │                             │
│   React SPA     │────▶│  Cloudflare     │────▶│      Convex Backend         │
│   (Mantine UI)  │     │  Worker/Pages   │     │                             │
│                 │     │                 │     │  • Real-time Database       │
└─────────────────┘     └────────┬────────┘     │  • Authentication           │
                                 │              │  • AI Agent (@convex/agent) │
                                 │              │  • Stripe Billing           │
                                 │              │  • Email (Resend)           │
                                 │              │                             │
                                 ▼              └──────────────┬──────────────┘
                        ┌─────────────────┐                    │
                        │                 │                    │
                        │    Sandbox      │◀───────────────────┘
                        │    Worker       │
                        │                 │    (Action calls sandbox
                        │  ┌───────────┐  │     to execute AWS CLI)
                        │  │ Container │  │
                        │  │ (AWS CLI) │  │
                        │  └───────────┘  │
                        │                 │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │   Customer's    │
                        │   AWS Account   │
                        │                 │
                        └─────────────────┘
```

### Component Overview

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 19 + Mantine v8 + TanStack Router | Single-page application with real-time updates |
| **State** | MobX + MobX React Lite | Reactive state management with Convex sync |
| **Backend** | Convex | Real-time database, serverless functions, authentication |
| **AI Agent** | @convex-dev/agent + OpenRouter | Autonomous AWS analysis with tool calling |
| **Sandbox** | Cloudflare Workers + Containers | Isolated AWS CLI execution environment |
| **Auth** | Better Auth + Convex | Email/password and social authentication |
| **Payments** | Stripe | Subscription billing with usage-based pricing |
| **Email** | Resend | Transactional emails and weekly summaries |

## Project Structure

```
aws-optimizer/
├── apps/
│   ├── web/              # React frontend (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── pages/        # Page components
│   │   │   ├── stores/       # MobX stores
│   │   │   └── worker.ts     # Cloudflare Worker (proxies to Convex)
│   │   └── wrangler.jsonc    # Cloudflare configuration
│   │
│   └── sandbox/          # Cloudflare Container Worker
│       ├── src/
│       │   └── index.ts      # Worker entry point
│       ├── Dockerfile        # AWS CLI container image
│       └── wrangler.jsonc    # Cloudflare configuration
│
├── packages/
│   └── convex/           # Convex backend
│       └── convex/
│           ├── ai/           # AI agent and tools
│           ├── betterAuth/   # Auth schema
│           ├── schema.ts     # Database schema
│           ├── functions.ts  # Auth helpers
│           └── *.ts          # Backend functions
│
└── package.json          # Monorepo root (npm workspaces)
```

## Getting Started

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm** - Comes with Node.js
- **Docker** - Required for sandbox development ([Download](https://docker.com/))
- **Convex CLI** - `npm install -g convex`
- **Wrangler CLI** - `npm install -g wrangler` (optional, for local worker testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/aws-optimizer.git
cd aws-optimizer

# Install all dependencies
npm install

# Set up environment variables (see below)
cp apps/web/.env.example apps/web/.env.local
```

### Environment Variables

#### Convex Backend (`packages/convex`)

Set these using `npx convex env set <NAME> <VALUE>`:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI agent |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `SANDBOX_URL` | Yes | URL of deployed sandbox worker |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for credential encryption |
| `SITE_URL` | Yes | Base URL of the web app |

#### Web Frontend (`apps/web`)

Create `.env.local` file:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |

#### Sandbox Worker (`apps/sandbox`)

No environment variables required - AWS credentials are passed per-request.

### Development

```bash
# Start all services (Convex + Web)
npm run dev

# Or start individually:
npm run dev:convex    # Convex backend
npm run dev:web       # React frontend (http://localhost:5173)
npm run dev:sandbox   # Sandbox worker (requires Docker)
```

### Running Tests

```bash
# Run all tests
npm test --workspaces

# Run tests for specific workspace
npm test --workspace=packages/convex
npm test --workspace=apps/web
npm test --workspace=apps/sandbox

# Watch mode
npm run test:watch --workspace=packages/convex
```

### Type Checking

```bash
# Check all workspaces
npm run typecheck

# Check specific workspace
npm run typecheck --workspace=apps/web
```

## Deployment

### Convex Backend

```bash
cd packages/convex

# Deploy to production
npx convex deploy

# Set production environment variables
npx convex env set OPENROUTER_API_KEY "sk-or-..."
npx convex env set RESEND_API_KEY "re_..."
# ... set all required variables
```

### Sandbox Worker

```bash
cd apps/sandbox

# Login to Cloudflare
wrangler login

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

See [apps/sandbox/README.md](apps/sandbox/README.md) for detailed sandbox deployment instructions.

### Web Frontend

```bash
cd apps/web

# Login to Cloudflare
wrangler login

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

See [apps/web/DEPLOYMENT.md](apps/web/DEPLOYMENT.md) for detailed frontend deployment instructions.

## AWS Account Connection

Users can connect their AWS accounts using two methods:

### 1. Cross-Account IAM Role (Recommended)

1. Download the CloudFormation template from the app
2. Deploy the stack in your AWS account
3. Enter the Role ARN in the app
4. The app assumes the role to perform analysis

### 2. Access Keys

1. Create an IAM user with read-only permissions
2. Generate access keys
3. Enter the credentials in the app
4. Credentials are encrypted at rest

See [docs/perm_requirements.md](../docs/perm_requirements.md) for required IAM permissions.

## API Reference

### Sandbox Worker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and AWS CLI version |
| `/execute` | POST | Execute an AWS CLI command |

See [apps/sandbox/README.md](apps/sandbox/README.md) for full API documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

Private - All rights reserved
