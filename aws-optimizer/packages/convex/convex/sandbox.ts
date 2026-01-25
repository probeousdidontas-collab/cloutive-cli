/**
 * Sandbox Action for AWS Command Execution
 *
 * Provides a Convex action that executes AWS CLI commands via the sandbox worker.
 * Features:
 * - Credential decryption at execution time
 * - Rate limiting via rate-limiter component
 * - Automatic retries via action-retrier component
 * - Execution logging to sandboxExecutions table
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { ActionRetrier } from "@convex-dev/action-retrier";
import { rateLimiter, logRateLimitEvent } from "./rateLimit";

// Initialize action retrier with component
const actionRetrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  maxFailures: 3,
  base: 2,
});

// Environment variables
const SANDBOX_WORKER_URL = process.env.SANDBOX_WORKER_URL;

// Response types matching sandbox worker
interface SandboxExecuteResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

/**
 * Simple credential decryption.
 * In production, use proper encryption (e.g., AWS KMS, libsodium).
 * For now, we strip the "encrypted-" prefix as a placeholder.
 */
function decryptCredential(encryptedValue: string): string {
  // Placeholder decryption - in production, use proper encryption
  // This strips the "encrypted-" prefix added during storage
  if (encryptedValue.startsWith("encrypted-")) {
    return encryptedValue.slice("encrypted-".length);
  }
  return encryptedValue;
}

/**
 * Validate that a command is an AWS CLI command.
 * Security measure to prevent arbitrary command execution.
 */
function validateAwsCommand(command: string): void {
  const trimmed = command.trim();
  if (!trimmed.startsWith("aws ") && trimmed !== "aws") {
    throw new Error("Only AWS CLI commands are allowed");
  }
}

// ============================================================================
// Internal Queries and Mutations
// ============================================================================

/**
 * Internal query to get AWS account by ID.
 */
export const getAwsAccount = internalQuery({
  args: {
    awsAccountId: v.id("awsAccounts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.awsAccountId);
  },
});

/**
 * Internal query to get credentials for an AWS account.
 */
export const getAwsCredentials = internalQuery({
  args: {
    awsAccountId: v.id("awsAccounts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", args.awsAccountId))
      .first();
  },
});

/**
 * Internal mutation to store execution results.
 * Called after the sandbox worker returns.
 */
export const storeExecution = internalMutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    command: v.string(),
    stdout: v.string(),
    stderr: v.string(),
    exitCode: v.number(),
    executionTime: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sandboxExecutions", {
      awsAccountId: args.awsAccountId,
      command: args.command,
      stdout: args.stdout,
      stderr: args.stderr,
      exitCode: args.exitCode,
      executionTime: args.executionTime,
      createdAt: Date.now(),
    });
  },
});

// ============================================================================
// Public Actions
// ============================================================================

/**
 * Execute an AWS CLI command in the sandbox.
 *
 * This action:
 * 1. Validates the AWS account exists and is active
 * 2. Retrieves and decrypts credentials
 * 3. Applies rate limiting
 * 4. Calls the sandbox worker
 * 5. Stores the execution result
 * 6. Returns the result
 */
export const executeCommand = action({
  args: {
    awsAccountId: v.id("awsAccounts"),
    command: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    stdout: v.string(),
    stderr: v.string(),
    exitCode: v.number(),
    executionTime: v.number(),
  }),
  handler: async (ctx, args): Promise<SandboxExecuteResponse> => {
    const { awsAccountId, command } = args;

    // Validate command is AWS CLI only
    validateAwsCommand(command);

    // Validate sandbox worker URL is configured
    if (!SANDBOX_WORKER_URL) {
      throw new Error("SANDBOX_WORKER_URL environment variable is not set");
    }

    // Get AWS account
    const awsAccount = await ctx.runQuery(internal.sandbox.getAwsAccount, {
      awsAccountId,
    });

    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    if (awsAccount.status !== "active") {
      throw new Error("AWS account is not active");
    }

    // Get credentials
    const credentials = await ctx.runQuery(internal.sandbox.getAwsCredentials, {
      awsAccountId,
    });

    if (!credentials) {
      throw new Error("Credentials not found for AWS account");
    }

    if (!credentials.encryptedAccessKeyId || !credentials.encryptedSecretAccessKey) {
      throw new Error("AWS credentials are incomplete");
    }

    // Apply rate limiting (10 commands per minute per org)
    const rateLimitResult = await rateLimiter.limit(ctx, "sandboxExecution", {
      key: awsAccountId,
      throws: false,
    });

    if (!rateLimitResult.ok) {
      // Log rate limit event for monitoring
      logRateLimitEvent({
        type: "sandboxExecution",
        key: awsAccountId,
        retryAfter: rateLimitResult.retryAfter,
      });

      throw new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.retryAfter / 1000)} seconds`
      );
    }

    // Decrypt credentials at execution time
    const decryptedCredentials: AwsCredentials = {
      accessKeyId: decryptCredential(credentials.encryptedAccessKeyId),
      secretAccessKey: decryptCredential(credentials.encryptedSecretAccessKey),
      region: awsAccount.region || undefined,
    };

    // Call sandbox worker
    const response = await fetch(`${SANDBOX_WORKER_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: command.trim(),
        credentials: decryptedCredentials,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sandbox worker error: ${response.status} - ${errorText}`);
    }

    const result: SandboxExecuteResponse = await response.json();

    // Store execution result
    await ctx.runMutation(internal.sandbox.storeExecution, {
      awsAccountId,
      command: command.trim(),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
    });

    return result;
  },
});

/**
 * Execute command with automatic retries.
 * Uses the action-retrier component for reliability.
 */
export const executeCommandWithRetry = action({
  args: {
    awsAccountId: v.id("awsAccounts"),
    command: v.string(),
  },
  returns: v.string(), // Returns the run ID for tracking
  handler: async (ctx, args): Promise<string> => {
    // Start a retryable execution
    // Start a retryable execution using the action retrier
    const runId = await actionRetrier.run(
      ctx,
      internal.sandbox.executeCommandInternal,
      {
        awsAccountId: args.awsAccountId,
        command: args.command,
      }
    );

    return runId;
  },
});

/**
 * Internal action for retryable execution.
 * This is called by the action retrier.
 */
export const executeCommandInternal = internalAction({
  args: {
    awsAccountId: v.id("awsAccounts"),
    command: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    stdout: v.string(),
    stderr: v.string(),
    exitCode: v.number(),
    executionTime: v.number(),
  }),
  handler: async (ctx, args): Promise<SandboxExecuteResponse> => {
    const { awsAccountId, command } = args;

    // Validate command is AWS CLI only
    validateAwsCommand(command);

    // Validate sandbox worker URL is configured
    if (!SANDBOX_WORKER_URL) {
      throw new Error("SANDBOX_WORKER_URL environment variable is not set");
    }

    // Get AWS account
    const awsAccount = await ctx.runQuery(internal.sandbox.getAwsAccount, {
      awsAccountId,
    });

    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    if (awsAccount.status !== "active") {
      throw new Error("AWS account is not active");
    }

    // Get credentials
    const credentials = await ctx.runQuery(internal.sandbox.getAwsCredentials, {
      awsAccountId,
    });

    if (!credentials) {
      throw new Error("Credentials not found for AWS account");
    }

    if (!credentials.encryptedAccessKeyId || !credentials.encryptedSecretAccessKey) {
      throw new Error("AWS credentials are incomplete");
    }

    // Decrypt credentials at execution time
    const decryptedCredentials: AwsCredentials = {
      accessKeyId: decryptCredential(credentials.encryptedAccessKeyId),
      secretAccessKey: decryptCredential(credentials.encryptedSecretAccessKey),
      region: awsAccount.region || undefined,
    };

    // Call sandbox worker
    const response = await fetch(`${SANDBOX_WORKER_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: command.trim(),
        credentials: decryptedCredentials,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sandbox worker error: ${response.status} - ${errorText}`);
    }

    const result: SandboxExecuteResponse = await response.json();

    // Store execution result
    await ctx.runMutation(internal.sandbox.storeExecution, {
      awsAccountId,
      command: command.trim(),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
    });

    return result;
  },
});

/**
 * Check the status of a retryable execution.
 */
export const getExecutionStatus = action({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    return await actionRetrier.status(ctx, args.runId as `${string}|${string}`);
  },
});
