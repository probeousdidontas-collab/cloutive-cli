# AWS Optimizer Web Frontend

React single-page application for the AWS Manager platform.

## Tech Stack

- **React 19** - UI framework
- **Mantine v8** - Component library
- **TanStack Router** - Type-safe routing
- **MobX** - State management
- **Convex** - Real-time backend sync
- **Recharts** - Data visualization
- **TypeScript** - Type safety

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/          # Layout components (sidebar, header)
│   ├── charts/          # Chart components
│   └── common/          # Shared components
├── pages/               # Page components
│   ├── DashboardPage.tsx
│   ├── AwsAccountsPage.tsx
│   ├── AnalysisPage.tsx
│   └── ...
├── stores/              # MobX stores
│   ├── AuthStore.ts
│   ├── OrganizationStore.ts
│   └── ...
├── lib/                 # Utilities and helpers
├── routes/              # TanStack Router configuration
├── App.tsx              # Root component
├── main.tsx             # Entry point
└── worker.ts            # Cloudflare Worker (production proxy)
```

## Development

### Prerequisites

- Node.js 20+
- Running Convex backend (see `packages/convex`)

### Setup

```bash
# Install dependencies (from monorepo root)
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your Convex URL
# VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |

### Running Locally

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Run with coverage
npm run test -- --coverage
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The frontend is deployed to Cloudflare Pages using a Worker for routing.

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Architecture Notes

### Cloudflare Worker

In production, a Cloudflare Worker (`src/worker.ts`) handles:

1. **Static Assets** - Serves the built SPA from `/dist`
2. **Convex Proxy** - Routes `/convex/*` to Convex cloud
3. **Auth Proxy** - Routes `/api/auth/*` to Convex for Better Auth
4. **SPA Routing** - Returns `index.html` for client-side routes

### State Management

MobX stores sync with Convex using the `useConvexSync` hook:

```tsx
// Store automatically syncs with Convex queries
const organizations = useQuery(api.organizations.list);
useConvexSync(organizationStore, organizations);
```

### Authentication

Better Auth is used for authentication:

- Email/password registration and login
- Password reset via email
- Session management with JWT tokens

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run deploy:staging` | Deploy to staging |
| `npm run deploy:production` | Deploy to production |
