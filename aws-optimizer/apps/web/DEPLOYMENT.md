# AWS Optimizer Web - Cloudflare Pages Deployment

This document describes how to deploy the AWS Optimizer frontend to Cloudflare Pages.

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** - Install with `npm install -g wrangler`
3. **Wrangler Authentication** - Run `wrangler login`
4. **Convex Backend** - Ensure your Convex deployment is running

## Quick Start

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Configuration

### Environment Variables

Set these in `wrangler.jsonc` or via Cloudflare Dashboard:

| Variable | Description | Example |
|----------|-------------|----------|
| `VITE_CONVEX_URL` | Convex deployment URL | `https://your-deployment.convex.cloud` |

### Custom Domain

To set up a custom domain, add a `routes` section to the production environment in `wrangler.jsonc`:

```jsonc
"env": {
  "production": {
    "routes": [
      {
        "pattern": "app.yourdomain.com/*",
        "zone_name": "yourdomain.com"
      }
    ]
  }
}
```

Then configure DNS in Cloudflare:
1. Add a CNAME record pointing to your worker subdomain
2. Enable Cloudflare proxy (orange cloud)

## Architecture

The deployment uses a Cloudflare Worker to:

1. **Proxy Convex Traffic** - Routes `/convex/*` to Convex cloud for real-time sync
2. **Proxy Auth Traffic** - Routes `/api/auth/*` to Convex site for Better Auth
3. **Serve Static Assets** - All other requests serve the built SPA from `/dist`

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/auth/*  ─────────►  Convex Site (Better Auth)         │
│                                                              │
│  /convex/*    ─────────►  Convex Cloud (queries/mutations)  │
│                                                              │
│  /.well-known/* ────────►  Convex Site (JWKS/OpenID)        │
│                                                              │
│  /*           ─────────►  Static Assets (dist/)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Steps

### Manual Deployment

```bash
# 1. Install dependencies
npm install

# 2. Run typecheck
npm run typecheck

# 3. Run tests
npm run test

# 4. Build the frontend
npm run build

# 5. Deploy to staging
wrangler deploy --env staging

# 6. Deploy to production
wrangler deploy --env production
```

### Using the Deploy Script

```bash
# Make the script executable
chmod +x deploy.sh

# Deploy to staging (default)
./deploy.sh

# Deploy to production
./deploy.sh production
```

## Verification

After deployment, verify the app is working:

1. **Health Check**
   ```bash
   curl https://your-worker-url/api/health
   ```

2. **Load the App** - Open the URL in your browser

3. **Test Authentication** - Try signing in/up

4. **Check Convex Sync** - Verify real-time data updates work

## Troubleshooting

### Worker Not Found

Ensure you're logged in:
```bash
wrangler whoami
```

### Build Errors

Check TypeScript errors:
```bash
npm run typecheck
```

### Auth Not Working

Verify the Convex URL is correctly set:
```bash
curl https://your-worker-url/api/health
```

The response should show `"convexUrl": "configured"`.

### WebSocket Issues

Check Cloudflare dashboard logs for WebSocket upgrade failures.

## Local Development with Worker

```bash
# Build the frontend first
npm run build

# Start the worker locally
npm run wrangler:dev
```

This runs the worker locally, serving from `/dist`.

## Secrets Management

For sensitive configuration, use Wrangler secrets:

```bash
# Set a secret for production
wrangler secret put MY_SECRET --env production

# List secrets
wrangler secret list --env production
```
