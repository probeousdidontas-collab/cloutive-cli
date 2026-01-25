#!/bin/bash
#
# Deployment script for AWS Optimizer Sandbox Worker
# Usage: ./deploy.sh [environment]
#
# Environments: production, staging (default: staging)
#
# Prerequisites:
# - wrangler CLI installed and authenticated
# - Cloudflare account with Workers Containers access
# - Docker installed (for container builds)

set -e

ENV="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== AWS Optimizer Sandbox Deployment ==="
echo "Environment: $ENV"
echo "Working directory: $SCRIPT_DIR"
echo ""

# Change to script directory
cd "$SCRIPT_DIR"

# Validate environment
if [[ "$ENV" != "production" && "$ENV" != "staging" ]]; then
    echo "Error: Invalid environment '$ENV'. Use 'production' or 'staging'"
    exit 1
fi

# Check prerequisites
echo "=== Checking prerequisites ==="

if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler CLI is not installed"
    echo "Install with: npm install -g wrangler"
    exit 1
fi
echo "✓ wrangler CLI found"

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Docker is required for container builds"
    exit 1
fi
echo "✓ Docker found"

# Check wrangler authentication
if ! wrangler whoami &> /dev/null; then
    echo "Error: wrangler is not authenticated"
    echo "Run: wrangler login"
    exit 1
fi
echo "✓ wrangler authenticated"
echo ""

# Run typecheck
echo "=== Running typecheck ==="
npm run typecheck
echo "✓ Typecheck passed"
echo ""

# Run unit tests
echo "=== Running unit tests ==="
npm run test
echo "✓ Unit tests passed"
echo ""

# Deploy
echo "=== Deploying to $ENV ==="
wrangler deploy --env "$ENV"
echo "✓ Deployment complete"
echo ""

# Get deployed URL
if [[ "$ENV" == "production" ]]; then
    WORKER_NAME="aws-optimizer-sandbox-prod"
else
    WORKER_NAME="aws-optimizer-sandbox-staging"
fi

echo "=== Verifying deployment ==="
echo "Worker name: $WORKER_NAME"
echo ""

# Wait for deployment to propagate
echo "Waiting for deployment to propagate (10 seconds)..."
sleep 10

# The worker URL will be displayed by wrangler deploy
# User should run verification tests manually with:
# SANDBOX_URL=https://<worker-url> npm run test:deploy

echo ""
echo "=== Deployment Summary ==="
echo "Environment: $ENV"
echo "Worker: $WORKER_NAME"
echo ""
echo "Next steps:"
echo "1. Note the worker URL from the wrangler deploy output above"
echo "2. Verify health endpoint: curl https://<worker-url>/health"
echo "3. Run deployment tests:"
echo "   SANDBOX_URL=https://<worker-url> npm run test:deploy"
echo ""
echo "To test with AWS credentials:"
echo "   SANDBOX_URL=https://<worker-url> \\"
echo "   TEST_AWS_ACCESS_KEY_ID=<your-key> \\"
echo "   TEST_AWS_SECRET_ACCESS_KEY=<your-secret> \\"
echo "   npm run test:deploy"
echo ""
