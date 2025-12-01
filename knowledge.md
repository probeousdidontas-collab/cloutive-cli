# Cloutive CLI - Project Knowledge

## Overview

Cloutive CLI is an AWS infrastructure analysis tool that uses the `@codebuff/sdk` to programmatically run AI agent conversations. The AI agent autonomously executes `aws` CLI commands to gather data and generates comprehensive reports.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **AI SDK**: `@codebuff/sdk` (v0.9.1)
- **CLI Framework**: Commander.js
- **Output**: Chalk, Ora (spinners)

## Project Structure

```
src/
├── index.ts          # CLI entry point (commander setup)
├── codebuff.ts       # CodebuffAnalyzer class using SDK
├── logger.ts         # Event tracing and run summaries
└── prompts/
    └── aws-analysis.ts  # Prompt generation for AWS analysis

docs/
├── AWS_ANALYSIS_TEMPLATE.md  # Report template
└── perm_requirements.md      # AWS IAM permissions

logs/                 # Generated trace and summary files
artifacts/            # Generated reports
```

## How to Run

### Using with-secret.sh (Recommended)

The project requires `CODEBUFF_API_KEY` environment variable. Use the secret injection script:

```bash
# Check prerequisites
~/.config/scripts/with-secret.sh CODEBUFF_API_KEY -- bun run start check

# Run analysis
~/.config/scripts/with-secret.sh CODEBUFF_API_KEY -- bun run start analyze -p <aws-profile>

# Run snapshot
~/.config/scripts/with-secret.sh CODEBUFF_API_KEY -- bun run start snapshot -p <aws-profile>
```

### Manual Export

```bash
export CODEBUFF_API_KEY=your_api_key
bun run start analyze -p <aws-profile>
```

## Commands

| Command | Description |
|---------|-------------|
| `check` | Verify prerequisites (API key, AWS CLI) |
| `analyze` | Full infrastructure analysis report |
| `snapshot` | Quick system snapshot |

## Key Options

- `-p, --profile <profile>` - AWS CLI profile (required)
- `-r, --region <region>` - AWS region (optional, auto-detect)
- `-o, --output <file>` - Output file path
- `-s, --max-steps <number>` - Max AI agent steps (default: 50 for analyze, 25 for snapshot)
- `-c, --client <name>` - Client name for report
- `-n, --consultant <name>` - Consultant name for report

## Architecture

1. **CLI (index.ts)** - Parses arguments, validates prerequisites, creates analyzer
2. **CodebuffAnalyzer (codebuff.ts)** - Wraps `@codebuff/sdk` CodebuffClient
3. **Logger (logger.ts)** - Captures events, saves traces/summaries to `logs/`
4. **Prompts (prompts/aws-analysis.ts)** - Generates detailed prompts for the AI agent

## SDK Usage

```typescript
import { CodebuffClient } from '@codebuff/sdk';

const client = new CodebuffClient({ apiKey: process.env.CODEBUFF_API_KEY });

const result = await client.run({
  agent: 'codebuff/base@0.0.16',
  prompt: 'Your prompt here',
  cwd: process.cwd(),
  maxAgentSteps: 50,
  handleEvent: (event) => console.log(event),
});
```

## Example Validated Run

```bash
~/.config/scripts/with-secret.sh CODEBUFF_API_KEY -- bun run start snapshot -p system9 -o artifacts/test-snapshot.md
```

This successfully:
- Validated prerequisites
- Connected to Codebuff SDK
- Ran AI agent analysis
- Generated snapshot report
- Used 36 credits
