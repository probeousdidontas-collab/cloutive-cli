#!/bin/bash
#
# Test script for AWS Sandbox POC
# Usage: ./test-local.sh [profile] [region]
#
# Reads AWS credentials from local ~/.aws using the specified profile
# and sends a test request to the local worker.

set -e

PROFILE="${1:-default}"
REGION="${2:-us-east-1}"
WORKER_URL="${WORKER_URL:-http://localhost:8787}"

echo "=== AWS Sandbox POC Test ==="
echo "Profile: $PROFILE"
echo "Region: $REGION"
echo "Worker URL: $WORKER_URL"
echo ""

# Check if aws cli is available
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Get credentials from local AWS config
echo "Reading credentials from local AWS config..."
ACCESS_KEY_ID=$(aws configure get aws_access_key_id --profile "$PROFILE" 2>/dev/null || true)
SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key --profile "$PROFILE" 2>/dev/null || true)
SESSION_TOKEN=$(aws configure get aws_session_token --profile "$PROFILE" 2>/dev/null || true)

if [ -z "$ACCESS_KEY_ID" ] || [ -z "$SECRET_ACCESS_KEY" ]; then
    echo "Error: Could not read credentials for profile '$PROFILE'"
    echo "Make sure your AWS credentials are configured in ~/.aws/credentials"
    exit 1
fi

echo "Credentials loaded successfully"
echo ""

# Test health endpoint
echo "=== Testing /health endpoint ==="
curl -s "$WORKER_URL/health" | jq .
echo ""

# Build credentials JSON
if [ -n "$SESSION_TOKEN" ]; then
    CREDENTIALS_JSON=$(cat <<EOF
{
    "accessKeyId": "$ACCESS_KEY_ID",
    "secretAccessKey": "$SECRET_ACCESS_KEY",
    "sessionToken": "$SESSION_TOKEN",
    "region": "$REGION"
}
EOF
)
else
    CREDENTIALS_JSON=$(cat <<EOF
{
    "accessKeyId": "$ACCESS_KEY_ID",
    "secretAccessKey": "$SECRET_ACCESS_KEY",
    "region": "$REGION"
}
EOF
)
fi

# Test execute endpoint with sts get-caller-identity
echo "=== Testing /execute endpoint (sts get-caller-identity) ==="
REQUEST_BODY=$(cat <<EOF
{
    "command": "aws sts get-caller-identity",
    "credentials": $CREDENTIALS_JSON
}
EOF
)

curl -s -X POST "$WORKER_URL/execute" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY" | jq .
echo ""

# Test with s3 ls
echo "=== Testing /execute endpoint (s3 ls) ==="
REQUEST_BODY=$(cat <<EOF
{
    "command": "aws s3 ls",
    "credentials": $CREDENTIALS_JSON
}
EOF
)

curl -s -X POST "$WORKER_URL/execute" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY" | jq .
echo ""

echo "=== Tests complete ==="
