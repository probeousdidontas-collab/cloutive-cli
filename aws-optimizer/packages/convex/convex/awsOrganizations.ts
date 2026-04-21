/**
 * AWS Organizations Discovery and Batch Connect
 *
 * Phase 2: AWS Organizations discovery with auto-connect flow
 *
 * Features:
 * - Discover member accounts from AWS Organizations
 * - Batch approval workflow for discovered accounts
 * - Deploy IAM roles to member accounts via CloudFormation StackSets
 * - Track discovery and deployment progress
 */

import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { rateLimiter, logRateLimitEvent } from "./rateLimit";

// Platform account ID for cross-account role assumption
const PLATFORM_AWS_ACCOUNT_ID = process.env.PLATFORM_AWS_ACCOUNT_ID || "000000000000";

// Sandbox worker URL
const SANDBOX_WORKER_URL = process.env.SANDBOX_WORKER_URL;

/**
 * Simple credential decryption (placeholder).
 */
function decryptCredential(encryptedValue: string): string {
  if (encryptedValue.startsWith("encrypted-")) {
    return encryptedValue.slice("encrypted-".length);
  }
  return encryptedValue;
}

/**
 * Simple credential encryption (placeholder).
 */
function encryptCredential(value: string): string {
  return `encrypted-${value}`;
}

// ============================================================================
// Types
// ============================================================================

interface AwsOrganizationAccount {
  Id: string;           // 12-digit account ID
  Arn: string;          // Account ARN
  Email: string;        // Root email
  Name: string;         // Account name
  Status: string;       // ACTIVE, SUSPENDED, etc.
  JoinedMethod: string; // INVITED or CREATED
  JoinedTimestamp: string; // ISO timestamp
}

interface ListAccountsResponse {
  Accounts: AwsOrganizationAccount[];
  NextToken?: string;
}

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

type DiscoveryStatus = "pending" | "discovering" | "discovered" | "deploying" | "completed" | "failed";
type DiscoveredAccountStatus = "discovered" | "selected" | "connecting" | "connected" | "skipped" | "failed";

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the current discovery session for an organization.
 */
export const getCurrentDiscovery = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Get the most recent discovery session for this organization.
    // Auth/authorization is enforced at the API layer (Better Auth);
    // the caller must pass the organizationId they're currently viewing.
    const discovery = await ctx.db
      .query("awsOrgDiscoveries")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .first();

    return discovery;
  },
});

/**
 * List discovered accounts for a discovery session.
 */
export const listDiscoveredAccounts = query({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("discoveredAwsAccounts")
      .withIndex("by_discovery", (q) => q.eq("discoveryId", args.discoveryId))
      .collect();

    return accounts;
  },
});

/**
 * Get discovery session by ID.
 */
export const getDiscovery = query({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.discoveryId);
  },
});

/**
 * List all discovery sessions for an organization.
 */
export const listDiscoveries = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const discoveries = await ctx.db
      .query("awsOrgDiscoveries")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();

    return discoveries;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Start a new AWS Organizations discovery session.
 * User provides management account credentials.
 */
export const startDiscovery = mutation({
  args: {
    organizationId: v.id("organizations"),
    managementAccountNumber: v.string(),
    accessKeyId: v.string(),
    secretAccessKey: v.string(),
    sessionToken: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify the organization exists
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Note: Authentication and authorization are handled by Better Auth at the API layer.

    // Validate account number
    if (!/^\d{12}$/.test(args.managementAccountNumber)) {
      throw new Error("AWS account number must be exactly 12 digits");
    }

    // Create temporary AWS account for the management account
    const tempAwsAccountId = await ctx.db.insert("awsAccounts", {
      organizationId: args.organizationId,
      name: `Management Account (${args.managementAccountNumber})`,
      accountNumber: args.managementAccountNumber,
      connectionType: "access_key",
      status: "pending",
      description: "Temporary account for Organizations discovery",
      region: args.region || "us-east-1",
      createdAt: now,
      updatedAt: now,
    });

    // Store encrypted credentials
    await ctx.db.insert("awsCredentials", {
      awsAccountId: tempAwsAccountId,
      encryptedAccessKeyId: encryptCredential(args.accessKeyId),
      encryptedSecretAccessKey: encryptCredential(args.secretAccessKey),
      encryptedSessionToken: args.sessionToken ? encryptCredential(args.sessionToken) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Create discovery session
    const discoveryId = await ctx.db.insert("awsOrgDiscoveries", {
      organizationId: args.organizationId,
      managementAwsAccountId: tempAwsAccountId,
      managementAccountNumber: args.managementAccountNumber,
      status: "pending",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { discoveryId, managementAwsAccountId: tempAwsAccountId };
  },
});

/**
 * Internal mutation to update discovery status.
 */
export const updateDiscoveryStatus = internalMutation({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
    status: v.union(
      v.literal("pending"),
      v.literal("discovering"),
      v.literal("discovered"),
      v.literal("deploying"),
      v.literal("completed"),
      v.literal("failed")
    ),
    statusMessage: v.optional(v.string()),
    totalAccountsFound: v.optional(v.number()),
    accountsSelected: v.optional(v.number()),
    accountsConnected: v.optional(v.number()),
    stackSetName: v.optional(v.string()),
    stackSetOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.statusMessage !== undefined) updates.statusMessage = args.statusMessage;
    if (args.totalAccountsFound !== undefined) updates.totalAccountsFound = args.totalAccountsFound;
    if (args.accountsSelected !== undefined) updates.accountsSelected = args.accountsSelected;
    if (args.accountsConnected !== undefined) updates.accountsConnected = args.accountsConnected;
    if (args.stackSetName !== undefined) updates.stackSetName = args.stackSetName;
    if (args.stackSetOperationId !== undefined) updates.stackSetOperationId = args.stackSetOperationId;

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
    }

    await ctx.db.patch(args.discoveryId, updates);
  },
});

/**
 * Internal mutation to save discovered accounts.
 */
export const saveDiscoveredAccounts = internalMutation({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
    organizationId: v.id("organizations"),
    accounts: v.array(
      v.object({
        accountNumber: v.string(),
        accountName: v.string(),
        email: v.string(),
        accountArn: v.string(),
        joinedMethod: v.string(),
        joinedTimestamp: v.number(),
        awsStatus: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get existing connected accounts to avoid duplicates
    const existingAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const existingAccountNumbers = new Set(existingAccounts.map((a) => a.accountNumber));

    // Save each discovered account
    for (const account of args.accounts) {
      // Check if already discovered in this session
      const existing = await ctx.db
        .query("discoveredAwsAccounts")
        .withIndex("by_discovery", (q) => q.eq("discoveryId", args.discoveryId))
        .filter((q) => q.eq(q.field("accountNumber"), account.accountNumber))
        .first();

      if (existing) continue;

      // Determine initial status
      const isAlreadyConnected = existingAccountNumbers.has(account.accountNumber);
      const status: DiscoveredAccountStatus = isAlreadyConnected ? "connected" : "discovered";

      await ctx.db.insert("discoveredAwsAccounts", {
        discoveryId: args.discoveryId,
        organizationId: args.organizationId,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        email: account.email,
        accountArn: account.accountArn,
        joinedMethod: account.joinedMethod,
        joinedTimestamp: account.joinedTimestamp,
        awsStatus: account.awsStatus,
        status,
        statusMessage: isAlreadyConnected ? "Already connected" : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update selection status for discovered accounts.
 */
export const updateAccountSelections = mutation({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
    selections: v.array(
      v.object({
        accountId: v.id("discoveredAwsAccounts"),
        selected: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get discovery to verify organization
    const discovery = await ctx.db.get(args.discoveryId);
    if (!discovery) {
      throw new Error("Discovery session not found");
    }

    // Note: Authentication and authorization are handled by Better Auth at the API layer.

    // Update each selection
    for (const selection of args.selections) {
      const account = await ctx.db.get(selection.accountId);
      if (!account || account.discoveryId !== args.discoveryId) continue;

      // Only update if account is in discovered/selected state
      if (account.status === "discovered" || account.status === "selected") {
        await ctx.db.patch(selection.accountId, {
          status: selection.selected ? "selected" : "discovered",
          updatedAt: now,
        });
      }
    }

    // Update discovery counts
    const allAccounts = await ctx.db
      .query("discoveredAwsAccounts")
      .withIndex("by_discovery", (q) => q.eq("discoveryId", args.discoveryId))
      .collect();

    const selectedCount = allAccounts.filter((a) => a.status === "selected").length;

    await ctx.db.patch(args.discoveryId, {
      accountsSelected: selectedCount,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation to update a discovered account's status.
 */
export const updateDiscoveredAccountStatus = internalMutation({
  args: {
    accountId: v.id("discoveredAwsAccounts"),
    status: v.union(
      v.literal("discovered"),
      v.literal("selected"),
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    statusMessage: v.optional(v.string()),
    connectedAwsAccountId: v.optional(v.id("awsAccounts")),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.statusMessage !== undefined) updates.statusMessage = args.statusMessage;
    if (args.connectedAwsAccountId !== undefined) updates.connectedAwsAccountId = args.connectedAwsAccountId;

    await ctx.db.patch(args.accountId, updates);
  },
});

/**
 * Internal mutation to create an AWS account from a discovered account.
 */
export const createAwsAccountFromDiscovery = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    discoveredAccountId: v.id("discoveredAwsAccounts"),
    accountNumber: v.string(),
    name: v.string(),
    roleArn: v.string(),
    externalId: v.string(),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create AWS account
    const awsAccountId = await ctx.db.insert("awsAccounts", {
      organizationId: args.organizationId,
      name: args.name,
      accountNumber: args.accountNumber,
      connectionType: "iam_role",
      status: "pending",
      description: "Connected via AWS Organizations discovery",
      region: args.region || "us-east-1",
      createdAt: now,
      updatedAt: now,
    });

    // Store role credentials
    await ctx.db.insert("awsCredentials", {
      awsAccountId,
      roleArn: args.roleArn,
      externalId: args.externalId,
      sessionDuration: 3600,
      createdAt: now,
      updatedAt: now,
    });

    // Update discovered account reference
    await ctx.db.patch(args.discoveredAccountId, {
      connectedAwsAccountId: awsAccountId,
      status: "connected",
      statusMessage: "Successfully connected",
      updatedAt: now,
    });

    return awsAccountId;
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Discover member accounts from AWS Organizations.
 * Calls organizations:ListAccounts via sandbox.
 */
export const discoverMemberAccounts = action({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
  },
  returns: v.object({
    success: v.boolean(),
    accountCount: v.number(),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; accountCount: number; errorMessage?: string }> => {
    const { discoveryId } = args;

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(ctx, "orgDiscovery", {
      key: discoveryId,
      throws: false,
    });

    if (!rateLimitResult.ok) {
      logRateLimitEvent({
        type: "orgDiscovery",
        key: discoveryId,
        retryAfter: rateLimitResult.retryAfter,
      });

      return {
        success: false,
        accountCount: 0,
        errorMessage: `Rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.retryAfter / 1000)} seconds`,
      };
    }

    // Update status to discovering
    await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
      discoveryId,
      status: "discovering",
      statusMessage: "Discovering member accounts...",
    });

    // Get discovery session
    const discovery = await ctx.runQuery(internal.awsOrganizations.getDiscoveryInternal, {
      discoveryId,
    });

    if (!discovery || !discovery.managementAwsAccountId) {
      await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
        discoveryId,
        status: "failed",
        statusMessage: "Discovery session not found or missing management account",
      });
      return { success: false, accountCount: 0, errorMessage: "Discovery session not found" };
    }

    // Get credentials
    const credentials = await ctx.runQuery(internal.sandbox.getAwsCredentials, {
      awsAccountId: discovery.managementAwsAccountId,
    });

    if (!credentials || !credentials.encryptedAccessKeyId || !credentials.encryptedSecretAccessKey) {
      await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
        discoveryId,
        status: "failed",
        statusMessage: "Management account credentials not found",
      });
      return { success: false, accountCount: 0, errorMessage: "Credentials not found" };
    }

    // Call internal action to list accounts
    const result = await ctx.runAction(internal.awsOrganizations.listOrganizationAccountsInternal, {
      encryptedAccessKeyId: credentials.encryptedAccessKeyId,
      encryptedSecretAccessKey: credentials.encryptedSecretAccessKey,
      encryptedSessionToken: credentials.encryptedSessionToken,
      region: "us-east-1", // Organizations API only works in us-east-1
    });

    if (!result.success) {
      await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
        discoveryId,
        status: "failed",
        statusMessage: result.errorMessage || "Failed to list accounts",
      });
      return { success: false, accountCount: 0, errorMessage: result.errorMessage };
    }

    // Save discovered accounts
    await ctx.runMutation(internal.awsOrganizations.saveDiscoveredAccounts, {
      discoveryId,
      organizationId: discovery.organizationId,
      accounts: result.accounts,
    });

    // Update discovery status
    await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
      discoveryId,
      status: "discovered",
      statusMessage: `Found ${result.accounts.length} member accounts`,
      totalAccountsFound: result.accounts.length,
    });

    return { success: true, accountCount: result.accounts.length };
  },
});

/**
 * Internal query to get discovery session.
 */
export const getDiscoveryInternal = internalQuery({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.discoveryId);
  },
});

/**
 * Internal action to list AWS Organizations accounts.
 */
export const listOrganizationAccountsInternal = internalAction({
  args: {
    encryptedAccessKeyId: v.string(),
    encryptedSecretAccessKey: v.string(),
    encryptedSessionToken: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    accounts: v.array(
      v.object({
        accountNumber: v.string(),
        accountName: v.string(),
        email: v.string(),
        accountArn: v.string(),
        joinedMethod: v.string(),
        joinedTimestamp: v.number(),
        awsStatus: v.string(),
      })
    ),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    if (!SANDBOX_WORKER_URL) {
      return {
        success: false,
        accounts: [],
        errorMessage: "SANDBOX_WORKER_URL environment variable is not set",
      };
    }

    // Decrypt credentials
    const credentials: AwsCredentials = {
      accessKeyId: decryptCredential(args.encryptedAccessKeyId),
      secretAccessKey: decryptCredential(args.encryptedSecretAccessKey),
      sessionToken: args.encryptedSessionToken
        ? decryptCredential(args.encryptedSessionToken)
        : undefined,
      region: args.region || "us-east-1",
    };

    try {
      const allAccounts: Array<{
        accountNumber: string;
        accountName: string;
        email: string;
        accountArn: string;
        joinedMethod: string;
        joinedTimestamp: number;
        awsStatus: string;
      }> = [];

      let nextToken: string | undefined;

      // Paginate through all accounts
      do {
        const command = nextToken
          ? `aws organizations list-accounts --starting-token ${nextToken} --output json`
          : `aws organizations list-accounts --output json`;

        const response = await fetch(`${SANDBOX_WORKER_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, credentials }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            success: false,
            accounts: [],
            errorMessage: `Sandbox worker error: ${response.status} - ${errorText}`,
          };
        }

        const result: SandboxExecuteResponse = await response.json();

        if (result.exitCode !== 0 || !result.success) {
          let errorMessage = "Failed to list organization accounts";
          if (result.stderr) {
            if (result.stderr.includes("AccessDeniedException")) {
              errorMessage = "Access denied. Ensure the credentials have organizations:ListAccounts permission.";
            } else if (result.stderr.includes("AWSOrganizationsNotInUseException")) {
              errorMessage = "This AWS account is not a management account of an AWS Organization.";
            } else {
              errorMessage = result.stderr.substring(0, 300);
            }
          }
          return { success: false, accounts: [], errorMessage };
        }

        // Parse response
        const data: ListAccountsResponse = JSON.parse(result.stdout);

        for (const account of data.Accounts) {
          allAccounts.push({
            accountNumber: account.Id,
            accountName: account.Name,
            email: account.Email,
            accountArn: account.Arn,
            joinedMethod: account.JoinedMethod,
            joinedTimestamp: new Date(account.JoinedTimestamp).getTime(),
            awsStatus: account.Status,
          });
        }

        nextToken = data.NextToken;
      } while (nextToken);

      return { success: true, accounts: allAccounts };
    } catch (error) {
      return {
        success: false,
        accounts: [],
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Connect selected accounts from discovery.
 * Creates IAM role connections for each selected account.
 */
export const connectSelectedAccounts = action({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
    externalId: v.string(), // Shared external ID for all roles
    roleName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    connectedCount: v.number(),
    failedCount: v.number(),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    connectedCount: number;
    failedCount: number;
    errorMessage?: string;
  }> => {
    const { discoveryId, externalId, roleName = "AWSCostOptimizerRole" } = args;

    // Get discovery session
    const discovery = await ctx.runQuery(internal.awsOrganizations.getDiscoveryInternal, {
      discoveryId,
    });

    if (!discovery) {
      return { success: false, connectedCount: 0, failedCount: 0, errorMessage: "Discovery not found" };
    }

    // Update status to deploying
    await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
      discoveryId,
      status: "deploying",
      statusMessage: "Creating AWS account connections...",
    });

    // Get selected accounts
    const selectedAccounts = await ctx.runQuery(internal.awsOrganizations.getSelectedAccountsInternal, {
      discoveryId,
    });

    if (selectedAccounts.length === 0) {
      await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
        discoveryId,
        status: "failed",
        statusMessage: "No accounts selected for connection",
      });
      return { success: false, connectedCount: 0, failedCount: 0, errorMessage: "No accounts selected" };
    }

    let connectedCount = 0;
    let failedCount = 0;

    // Connect each selected account
    for (const account of selectedAccounts) {
      try {
        // Update status to connecting
        await ctx.runMutation(internal.awsOrganizations.updateDiscoveredAccountStatus, {
          accountId: account._id,
          status: "connecting",
          statusMessage: "Creating IAM role connection...",
        });

        // Build role ARN
        const roleArn = `arn:aws:iam::${account.accountNumber}:role/${roleName}`;

        // Create AWS account with IAM role credentials
        await ctx.runMutation(internal.awsOrganizations.createAwsAccountFromDiscovery, {
          organizationId: discovery.organizationId,
          discoveredAccountId: account._id,
          accountNumber: account.accountNumber,
          name: account.accountName,
          roleArn,
          externalId,
          region: "us-east-1",
        });

        connectedCount++;
      } catch (error) {
        failedCount++;
        await ctx.runMutation(internal.awsOrganizations.updateDiscoveredAccountStatus, {
          accountId: account._id,
          status: "failed",
          statusMessage: error instanceof Error ? error.message : "Connection failed",
        });
      }
    }

    // Update discovery status
    const finalStatus: DiscoveryStatus = failedCount === 0 ? "completed" : (connectedCount > 0 ? "completed" : "failed");
    await ctx.runMutation(internal.awsOrganizations.updateDiscoveryStatus, {
      discoveryId,
      status: finalStatus,
      statusMessage: `Connected ${connectedCount} accounts${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      accountsConnected: connectedCount,
    });

    return {
      success: connectedCount > 0,
      connectedCount,
      failedCount,
    };
  },
});

/**
 * Internal query to get selected accounts.
 */
export const getSelectedAccountsInternal = internalQuery({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discoveredAwsAccounts")
      .withIndex("by_discovery_status", (q) =>
        q.eq("discoveryId", args.discoveryId).eq("status", "selected")
      )
      .collect();
  },
});

// ============================================================================
// CloudFormation StackSet Template Generation
// ============================================================================

/**
 * Generate CloudFormation StackSet template for deploying IAM roles to member accounts.
 */
export const generateStackSetTemplate = query({
  args: {
    externalId: v.string(),
    roleName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { externalId, roleName = "AWSCostOptimizerRole" } = args;

    const template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Description: "AWS Manager IAM Role - Deployed via StackSets for Organizations member accounts",
      Parameters: {
        ExternalId: {
          Type: "String",
          Default: externalId,
          Description: "External ID for secure cross-account access",
        },
        RoleName: {
          Type: "String",
          Default: roleName,
          Description: "Name of the IAM role to create",
        },
        PlatformAccountId: {
          Type: "String",
          Default: PLATFORM_AWS_ACCOUNT_ID,
          Description: "AWS Account ID of the Cost Optimizer platform",
        },
      },
      Resources: {
        CostOptimizerRole: {
          Type: "AWS::IAM::Role",
          Properties: {
            RoleName: { Ref: "RoleName" },
            AssumeRolePolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: {
                    AWS: { "Fn::Sub": "arn:aws:iam::${PlatformAccountId}:root" },
                  },
                  Action: "sts:AssumeRole",
                  Condition: {
                    StringEquals: {
                      "sts:ExternalId": { Ref: "ExternalId" },
                    },
                  },
                },
              ],
            },
            ManagedPolicyArns: [
              "arn:aws:iam::aws:policy/ReadOnlyAccess",
              "arn:aws:iam::aws:policy/SecurityAudit",
            ],
            Tags: [
              { Key: "Purpose", Value: "AWS Manager Platform Access" },
              { Key: "ManagedBy", Value: "CloudFormation StackSets" },
            ],
          },
        },
      },
      Outputs: {
        RoleArn: {
          Description: "ARN of the created IAM role",
          Value: { "Fn::GetAtt": ["CostOptimizerRole", "Arn"] },
        },
        ExternalId: {
          Description: "External ID used for role assumption",
          Value: { Ref: "ExternalId" },
        },
      },
    };

    return { template: JSON.stringify(template, null, 2) };
  },
});

/**
 * Generate instructions for setting up StackSets.
 */
export const getStackSetInstructions = query({
  args: {
    discoveryId: v.id("awsOrgDiscoveries"),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get discovery to get account list
    const discovery = await ctx.db.get(args.discoveryId);
    if (!discovery) {
      return null;
    }

    // Get selected accounts
    const selectedAccounts = await ctx.db
      .query("discoveredAwsAccounts")
      .withIndex("by_discovery_status", (q) =>
        q.eq("discoveryId", args.discoveryId).eq("status", "selected")
      )
      .collect();

    const accountIds = selectedAccounts.map((a) => a.accountNumber);

    const instructions = {
      step1: {
        title: "Enable StackSets in AWS Organizations",
        description: "Run this command in CloudShell or your terminal with management account credentials:",
        command: "aws organizations enable-aws-service-access --service-principal stacksets.cloudformation.amazonaws.com",
      },
      step2: {
        title: "Create the StackSet",
        description: "Create a StackSet using the template provided:",
        command: `aws cloudformation create-stack-set --stack-set-name AWSCostOptimizerRoles --template-body file://stackset-template.yaml --permission-model SERVICE_MANAGED --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false`,
      },
      step3: {
        title: "Deploy to Member Accounts",
        description: `Deploy the IAM role to ${accountIds.length} selected member accounts:`,
        command: `aws cloudformation create-stack-instances --stack-set-name AWSCostOptimizerRoles --deployment-targets Accounts=${accountIds.join(",")} --regions us-east-1`,
      },
      selectedAccountIds: accountIds,
      externalId: args.externalId,
    };

    return instructions;
  },
});
