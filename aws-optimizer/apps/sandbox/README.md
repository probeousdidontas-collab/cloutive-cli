# AWS Optimizer Sandbox Worker

Cloudflare Worker with Containers that provides secure AWS CLI execution.

## Overview

This worker runs AWS CLI commands in an isolated Cloudflare Container environment. It accepts credentials per-request and executes AWS commands securely.

## Endpoints

### GET /health

Health check endpoint that verifies the sandbox container is ready.

**Response:**
```json
{
  "status": "ok",
  "awsCliVersion": "aws-cli/2.15.0 Python/3.11.6",
  "sandboxReady": true
}
```

### POST /execute

Execute an AWS CLI command with provided credentials.

**Request:**
```json
{
  "command": "aws sts get-caller-identity",
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "sessionToken": "optional-session-token",
    "region": "us-east-1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "{\"UserId\": \"AIDAEXAMPLE\", ...}",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 1234
}
```

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for container builds)
- wrangler CLI (`npm install -g wrangler`)

### Setup

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

### Local Testing

```bash
# Run unit tests
npm test

# Test local endpoints with AWS credentials
./test-local.sh <aws-profile> [region]
```

## Deployment

### Prerequisites

1. **Cloudflare Account**: With Workers Containers access enabled
2. **wrangler CLI**: Authenticated with `wrangler login`
3. **Docker**: For building the container image

### Deployment Steps

#### Option 1: Using the deploy script (recommended)

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

#### Option 2: Manual deployment

```bash
# Typecheck and test
npm run typecheck
npm run test

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

### Post-Deployment Verification

1. **Verify health endpoint:**
   ```bash
   curl https://aws-optimizer-sandbox-prod.<your-account>.workers.dev/health
   ```

2. **Run deployment tests:**
   ```bash
   # Health endpoint only
   SANDBOX_URL=https://your-worker-url npm run test:deploy

   # Full tests with AWS credentials
   SANDBOX_URL=https://your-worker-url \
   TEST_AWS_ACCESS_KEY_ID=<your-key> \
   TEST_AWS_SECRET_ACCESS_KEY=<your-secret> \
   npm run test:deploy
   ```

### Environment Configuration

The worker is configured with two environments in `wrangler.jsonc`:

| Environment | Worker Name | Max Instances |
|-------------|-------------|---------------|
| staging | aws-optimizer-sandbox-staging | 2 |
| production | aws-optimizer-sandbox-prod | 5 |

### Secrets Management

Currently, no secrets are required as AWS credentials are passed per-request.

For future features, secrets can be set with:
```bash
# Set a secret for production
wrangler secret put SECRET_NAME --env production

# Set a secret for staging
wrangler secret put SECRET_NAME --env staging
```

## Security

- **Command Restriction**: Only commands starting with `aws ` are allowed
- **Isolated Execution**: Each command runs in an isolated container
- **No Credential Storage**: Credentials are used in-memory and not persisted
- **CORS**: Configured for cross-origin requests (configurable in production)

## Troubleshooting

### Health endpoint returns 503

1. Check that the container image built successfully
2. Verify Docker is installed on the build machine
3. Check Cloudflare dashboard for deployment logs

### Commands fail with credential errors

1. Verify credentials are valid and not expired
2. Check that session tokens are included if using temporary credentials
3. Ensure the IAM user/role has the required permissions

### Container startup slow

First requests may be slow due to container cold start. Subsequent requests will be faster.

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local development server |
| `npm run test` | Run unit tests |
| `npm run test:deploy` | Run deployment verification tests |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run deploy:staging` | Deploy to staging environment |
| `npm run deploy:production` | Deploy to production environment |
