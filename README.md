# Cloutive CLI

AWS Infrastructure Analysis CLI Tool - Uses **Codebuff AI SDK** to generate comprehensive infrastructure reports.

## Overview

Cloutive CLI leverages the `@codebuff/sdk` to programmatically run AI agent conversations that analyze your AWS infrastructure using the `aws` CLI tool and generate detailed reports based on professional templates.

## Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0.0+)
- [AWS CLI](https://aws.amazon.com/cli/) v2 installed and configured
- AWS profile with read-only access (see `docs/perm_requirements.md`)
- **Codebuff API key** - Get one at [codebuff.com](https://codebuff.com)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd cloutive-cli

# Install dependencies
bun install

# Set your Codebuff API key
export CODEBUFF_API_KEY=your_api_key_here
```

## Usage

### Check Prerequisites

```bash
bun run start check
```

This verifies:
- `CODEBUFF_API_KEY` environment variable is set
- AWS CLI is installed

### Generate Full Analysis Report

```bash
# Basic usage
bun run start analyze --profile my-aws-profile

# With all options
bun run start analyze \
  --profile my-aws-profile \
  --region eu-central-1 \
  --output reports/client-report.md \
  --client "Acme Corp" \
  --consultant "John Doe" \
  --max-steps 50
```

### Generate Quick Snapshot

```bash
bun run start snapshot --profile my-aws-profile
```

## Commands

| Command | Description |
|---------|-------------|
| `analyze` | Generate comprehensive AWS infrastructure analysis report |
| `snapshot` | Generate quick AWS system snapshot |
| `check` | Verify all prerequisites are installed |

## Options for `analyze`

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `-p, --profile <profile>` | Yes | AWS CLI profile name | - |
| `-r, --region <region>` | No | AWS region | auto-detect |
| `-o, --output <file>` | No | Output file path | `aws-analysis-report.md` |
| `-c, --client <name>` | No | Client name for report | - |
| `-n, --consultant <name>` | No | Consultant name | - |
| `-s, --max-steps <number>` | No | Maximum AI agent steps | `50` |

## Options for `snapshot`

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `-p, --profile <profile>` | Yes | AWS CLI profile name | - |
| `-r, --region <region>` | No | AWS region | auto-detect |
| `-o, --output <file>` | No | Output file path | `aws-snapshot.md` |
| `-s, --max-steps <number>` | No | Maximum AI agent steps | `25` |

## How It Works

1. **Validates prerequisites** - Checks for `CODEBUFF_API_KEY`, AWS CLI, and valid AWS profile
2. **Generates prompt** - Creates a detailed prompt for the Codebuff AI agent
3. **Runs Codebuff SDK** - The `@codebuff/sdk` client executes an AI agent that autonomously uses `aws` CLI commands to gather data
4. **Generates report** - Creates a comprehensive markdown report based on the template
5. **Logs results** - Saves event traces and run summaries to `logs/` directory

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CODEBUFF_API_KEY` | Yes | Your Codebuff API key from [codebuff.com](https://codebuff.com) |

## Report Template

The analysis is based on the template at `docs/AWS_ANALYSIS_TEMPLATE.md` which includes:

- Executive Summary with health scores
- Infrastructure inventory (EC2, RDS, S3, Lambda, ECS, etc.)
- Security assessment (IAM, encryption, network security)
- Cost analysis & optimization opportunities
- Performance & reliability assessment
- Risk assessment matrix
- Prioritized recommendations

## AWS Permissions

See `docs/perm_requirements.md` for the IAM permissions required for a complete analysis.

**Quick setup:**
```bash
# Attach these managed policies to your IAM user/role:
# - arn:aws:iam::aws:policy/ReadOnlyAccess
# - arn:aws:iam::aws:policy/SecurityAudit
```

## Examples

```bash
# Analyze production account
bun run start analyze -p prod-account -r us-east-1 -o prod-report.md

# Quick snapshot of dev account
bun run start snapshot -p dev-account -o dev-snapshot.md

# Full consultant report with more agent steps
bun run start analyze \
  -p client-readonly \
  -r eu-central-1 \
  -o "reports/$(date +%Y-%m-%d)-acme-analysis.md" \
  -c "Acme Corporation" \
  -n "Jane Smith, AWS Solutions Architect" \
  -s 75
```

## Output

After a successful run, you'll see:
- **Report file** - The generated markdown report
- **Credits used** - Codebuff API credits consumed
- **Trace log** - Detailed event trace in `logs/codebuff-trace-*.json`
- **Run summary** - Summary in `logs/run-summary-*.json`

## License

MIT
