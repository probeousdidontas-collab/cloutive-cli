# AWS Cost Optimizer

An AI-first SaaS platform for AWS cost analysis and optimization.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite + Mantine v8 |
| **Routing** | TanStack Router |
| **State Management** | MobX + MobX React Lite |
| **Backend** | Convex (real-time database, functions, actions) |
| **AI Engine** | `@convex-dev/agent` with OpenRouter |
| **Sandbox Execution** | Cloudflare Containers with AWS CLI v2 |

## Project Structure

```
aws-optimizer/
├── apps/
│   ├── web/          # React frontend
│   └── sandbox/      # Cloudflare Container (AWS CLI)
├── packages/
│   └── convex/       # Convex backend
└── package.json      # Monorepo root
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Convex CLI (`npm install -g convex`)

### Installation

```bash
# Install all dependencies
npm install

# Start development servers
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env.local` in `apps/web/` and update:

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

## Development

```bash
# Start Convex dev server
npm run dev:convex

# Start web frontend
npm run dev:web

# Start sandbox worker (requires wrangler)
npm run dev:sandbox
```

## License

Private - All rights reserved
