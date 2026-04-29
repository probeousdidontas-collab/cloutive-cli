#!/bin/bash
#
# Deployment script for AWS Optimizer — orchestrates the whole Convex project.
# Usage: ./deploy.sh [environment]
#
# Environments: production, staging (default: staging)
#
# What this does, in order:
#   1. Resolve wrangler + check Cloudflare auth
#   2. Lint web (errors block; warnings don't)
#   3. Convex sync check — frontend references match backend functions
#   4. Push Convex backend
#       - staging: pushes to dev:quirky-sparrow-76 via `convex dev --once`
#                  (no separate staging deployment exists yet — see TEAMTODO P1)
#       - production: `convex deploy` (requires CONVEX_DEPLOY_KEY for prod)
#   5. Build frontend (Vite → dist/)
#   6. Deploy frontend (wrangler deploy --env $ENV)
#
# Backend before frontend on purpose: the deployed bundle must hit a backend
# that has the function references it expects. Frontend-first leaves a window
# where prod traffic 404s on new functions.

set -e

ENV="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR"
CONVEX_DIR="$SCRIPT_DIR/../../packages/convex"
WORKSPACE_ROOT="$SCRIPT_DIR/../.."

echo "=== AWS Optimizer Deployment ==="
echo "Environment: $ENV"
echo "Web:    $WEB_DIR"
echo "Convex: $CONVEX_DIR"
echo ""

# Validate environment
if [[ "$ENV" != "production" && "$ENV" != "staging" ]]; then
    echo "Error: Invalid environment '$ENV'. Use 'production' or 'staging'"
    exit 1
fi

# Resolve wrangler — prefer the workspace-local copy via npx, fall back to a global install.
if command -v wrangler &> /dev/null; then
    WRANGLER="wrangler"
else
    WRANGLER="npx wrangler"
fi

# ───────────────────────────────────────────────────────────────────────────
# 1. Prerequisites
# ───────────────────────────────────────────────────────────────────────────
echo "=== [1/6] Checking prerequisites ==="
cd "$WEB_DIR"

if ! $WRANGLER --version &> /dev/null; then
    echo "Error: wrangler CLI is not available (tried '$WRANGLER')"
    echo "Install in workspace with: npm install --save-dev wrangler"
    exit 1
fi
echo "✓ wrangler CLI found ($WRANGLER)"

if ! $WRANGLER whoami &> /dev/null; then
    echo "Error: wrangler is not authenticated"
    echo "Run: $WRANGLER login"
    exit 1
fi
echo "✓ wrangler authenticated"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# 2. Lint web (errors block the deploy)
# ───────────────────────────────────────────────────────────────────────────
echo "=== [2/6] Linting web ==="
npm run lint
echo "✓ Lint clean"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# 3. Convex sync check — frontend references match backend functions
# ───────────────────────────────────────────────────────────────────────────
echo "=== [3/6] Convex sync check ==="
cd "$WORKSPACE_ROOT"
npx --yes @fatagnus/convex-sync-check \
    --convex-dir packages/convex/convex \
    --frontend-dir apps/web/src
echo "✓ Convex sync check passed"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# 4. Convex backend deploy
# ───────────────────────────────────────────────────────────────────────────
echo "=== [4/6] Convex backend deploy ($ENV) ==="
cd "$CONVEX_DIR"
if [[ "$ENV" == "production" ]]; then
    if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
        echo "Error: CONVEX_DEPLOY_KEY is required for production Convex deploy."
        echo "A production Convex deployment isn't set up yet (TEAMTODO P1)."
        echo "Get the deploy key from the Convex dashboard once prod is provisioned."
        exit 1
    fi
    npx convex deploy
else
    # Staging shares the dev deployment (dev:quirky-sparrow-76).
    # `convex dev --once` pushes current code and exits.
    npx convex dev --once
fi
echo "✓ Convex backend deployed"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# 5. Build frontend
# ───────────────────────────────────────────────────────────────────────────
echo "=== [5/6] Building frontend ==="
cd "$WEB_DIR"
npm run build
echo "✓ Build complete"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# 6. Deploy frontend
# ───────────────────────────────────────────────────────────────────────────
echo "=== [6/6] Deploying frontend to $ENV ==="
$WRANGLER deploy --env "$ENV"
echo "✓ Frontend deployed"
echo ""

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────
if [[ "$ENV" == "production" ]]; then
    WORKER_NAME="aws-optimizer-web-prod"
else
    WORKER_NAME="aws-optimizer-web-staging"
fi

echo "=== Deployment Summary ==="
echo "Environment: $ENV"
echo "Worker:      $WORKER_NAME"
echo ""
echo "Next steps:"
echo "1. Note the worker URL from the wrangler output above"
echo "2. Smoke-test login + a query that hits the Convex backend"
echo "3. Watch logs: $WRANGLER tail --env $ENV"
echo ""
