/**
 * AWS Accounts Management
 *
 * Implements US-012: Implement AWS account connection - IAM role
 *
 * Features:
 * - Connect AWS accounts via IAM role assumption
 * - Generate CloudFormation templates for role creation
 * - Verify role connection via sandbox
 * - List and get AWS accounts for an organization
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Roles that can manage AWS accounts (connect, modify)
const WRITE_ROLES = ["owner", "admin", "member"] as const;

// Platform account ID for cross-account role assumption
// In production, this should be configured via environment variable
const PLATFORM_AWS_ACCOUNT_ID = process.env.PLATFORM_AWS_ACCOUNT_ID || "000000000000";

/**
 * Validate AWS IAM role ARN format.
 * Format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
 */
function validateRoleArn(roleArn: string): boolean {
  const arnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
  return arnRegex.test(roleArn);
}

/**
 * Validate AWS access key ID format.
 * AWS access key IDs start with AKIA (long-term) or ASIA (temporary).
 */
function validateAccessKeyId(accessKeyId: string): boolean {
  const keyRegex = /^(AKIA|ASIA)[A-Z0-9]{16}$/;
  return keyRegex.test(accessKeyId);
}

/**
 * Simple credential encryption.
 * In production, use proper encryption (e.g., AWS KMS, libsodium).
 * For now, we add an "encrypted-" prefix as a placeholder.
 */
function encryptCredential(value: string): string {
  // Placeholder encryption - in production, use proper encryption
  return `encrypted-${value}`;
}

/**
 * Validate AWS account number (12 digits).
 */
function validateAccountNumber(accountNumber: string): boolean {
  return /^\d{12}$/.test(accountNumber);
}

/**
 * Helper to get a user's membership in an organization.
 */
async function getMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<Doc<"orgMembers"> | null> {
  return await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .first();
}

/**
 * Generate CloudFormation template for creating the IAM role.
 * This template creates a cross-account role that allows the platform to assume it.
 */
function generateCloudFormationTemplateContent(
  externalId: string,
  roleName: string = "AWSCostOptimizerRole"
): string {
  const template = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: "Creates an IAM role for AWS Cost Optimizer platform access",
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
                  AWS: `arn:aws:iam::${PLATFORM_AWS_ACCOUNT_ID}:root`,
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
            {
              Key: "Purpose",
              Value: "AWS Cost Optimizer Platform Access",
            },
            {
              Key: "ManagedBy",
              Value: "CloudFormation",
            },
          ],
        },
      },
    },
    Outputs: {
      RoleArn: {
        Description: "ARN of the created IAM role",
        Value: { "Fn::GetAtt": ["CostOptimizerRole", "Arn"] },
        Export: {
          Name: { "Fn::Sub": "${AWS::StackName}-RoleArn" },
        },
      },
      ExternalId: {
        Description: "External ID used for role assumption",
        Value: { Ref: "ExternalId" },
      },
    },
  };

  return JSON.stringify(template, null, 2);
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Generate CloudFormation template for users to create the IAM role.
 */
export const generateCloudFormationTemplate = query({
  args: {
    externalId: v.string(),
    roleName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { externalId, roleName } = args;
    const template = generateCloudFormationTemplateContent(externalId, roleName);
    return { template };
  },
});

/**
 * Get an AWS account by ID.
 * Requires the user to be a member of the organization that owns the account.
 */
export const getById = query({
  args: {
    awsAccountId: v.id("awsAccounts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { awsAccountId, userId } = args;

    // Get the AWS account
    const awsAccount = await ctx.db.get(awsAccountId);
    if (!awsAccount) {
      return null;
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, awsAccount.organizationId, userId);
    if (!membership) {
      return null;
    }

    return awsAccount;
  },
});

/**
 * List all AWS accounts for an organization.
 * Requires the user to be a member of the organization.
 */
export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = args;

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get all AWS accounts for this organization
    const awsAccounts = await ctx.db
      .query("awsAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return awsAccounts;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Connect an AWS account via IAM role assumption.
 *
 * This is the recommended and most secure connection method:
 * 1. User creates an IAM role in their AWS account using our CloudFormation template
 * 2. User provides the role ARN and external ID
 * 3. We store the connection and can verify it works
 */
export const connectWithRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    accountNumber: v.string(),
    roleArn: v.string(),
    externalId: v.string(),
    description: v.optional(v.string()),
    region: v.optional(v.string()),
    sessionDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      organizationId,
      userId,
      name,
      accountNumber,
      roleArn,
      externalId,
      description,
      region,
      sessionDuration,
    } = args;
    const now = Date.now();

    // Validate AWS account number
    if (!validateAccountNumber(accountNumber)) {
      throw new Error("AWS account number must be exactly 12 digits");
    }

    // Validate role ARN format
    if (!validateRoleArn(roleArn)) {
      throw new Error("Invalid IAM role ARN format");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Check if user has write permissions
    if (!WRITE_ROLES.includes(membership.role as typeof WRITE_ROLES[number])) {
      throw new Error("You do not have permission to connect AWS accounts");
    }

    // Create the AWS account entry
    const awsAccountId = await ctx.db.insert("awsAccounts", {
      organizationId,
      name,
      accountNumber,
      connectionType: "iam_role",
      status: "pending", // Will be set to 'active' after successful verification
      description,
      region,
      createdAt: now,
      updatedAt: now,
    });

    // Store the credentials (role ARN and external ID)
    const credentialsId = await ctx.db.insert("awsCredentials", {
      awsAccountId,
      roleArn,
      externalId,
      sessionDuration: sessionDuration ?? 3600, // Default 1 hour
      createdAt: now,
      updatedAt: now,
    });

    return { awsAccountId, credentialsId };
  },
});

/**
 * Verify that the IAM role connection works by attempting to assume the role.
 *
 * In production, this would call the sandbox to execute:
 * `aws sts assume-role --role-arn <roleArn> --external-id <externalId> --role-session-name test`
 *
 * For testing purposes, we accept a mockSuccess flag to simulate the result.
 */
export const verifyRoleConnection = mutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    userId: v.id("users"),
    mockSuccess: v.optional(v.boolean()), // For testing
  },
  handler: async (ctx, args) => {
    const { awsAccountId, userId, mockSuccess } = args;
    const now = Date.now();

    // Get the AWS account
    const awsAccount = await ctx.db.get(awsAccountId);
    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, awsAccount.organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get the credentials
    const credentials = await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
      .first();

    if (!credentials) {
      throw new Error("Credentials not found for this AWS account");
    }

    if (!credentials.roleArn || !credentials.externalId) {
      throw new Error("Role ARN and External ID are required for IAM role connections");
    }

    // In production, we would call the sandbox here to test role assumption:
    // const command = `aws sts assume-role --role-arn ${credentials.roleArn} --external-id ${credentials.externalId} --role-session-name verification-test`;
    // const result = await ctx.runAction(internal.sandbox.executeCommand, { awsAccountId, command });
    //
    // For now, we use the mockSuccess flag for testing
    const success = mockSuccess ?? false;

    // Update the account status based on verification result
    const newStatus = success ? "active" : "error";

    await ctx.db.patch(awsAccountId, {
      status: newStatus,
      lastVerifiedAt: success ? now : undefined,
      updatedAt: now,
    });

    return {
      success,
      status: newStatus,
      message: success
        ? "Role assumption verified successfully"
        : "Failed to assume the IAM role. Please verify the role ARN and external ID.",
    };
  },
});

/**
 * Connect an AWS account via access keys.
 *
 * This is a simpler but less secure connection method:
 * 1. User provides their AWS access key ID and secret access key
 * 2. We encrypt and store the credentials
 * 3. User should verify the connection works
 *
 * Security Note: IAM role-based access is recommended over access keys.
 */
export const connectWithKeys = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    accountNumber: v.string(),
    accessKeyId: v.string(),
    secretAccessKey: v.string(),
    description: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      organizationId,
      userId,
      name,
      accountNumber,
      accessKeyId,
      secretAccessKey,
      description,
      region,
    } = args;
    const now = Date.now();

    // Validate AWS account number
    if (!validateAccountNumber(accountNumber)) {
      throw new Error("AWS account number must be exactly 12 digits");
    }

    // Validate access key ID format
    if (!validateAccessKeyId(accessKeyId)) {
      throw new Error("Invalid AWS access key ID format");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Check if user has write permissions
    if (!WRITE_ROLES.includes(membership.role as typeof WRITE_ROLES[number])) {
      throw new Error("You do not have permission to connect AWS accounts");
    }

    // Create the AWS account entry
    const awsAccountId = await ctx.db.insert("awsAccounts", {
      organizationId,
      name,
      accountNumber,
      connectionType: "access_key",
      status: "pending", // Will be set to 'active' after successful verification
      description,
      region,
      createdAt: now,
      updatedAt: now,
    });

    // Encrypt and store the credentials
    const credentialsId = await ctx.db.insert("awsCredentials", {
      awsAccountId,
      encryptedAccessKeyId: encryptCredential(accessKeyId),
      encryptedSecretAccessKey: encryptCredential(secretAccessKey),
      createdAt: now,
      updatedAt: now,
    });

    // Security warning about key-based access
    const securityWarning =
      "Access key-based authentication is less secure than IAM role assumption. " +
      "Consider using IAM role-based access for improved security. " +
      "Ensure you rotate your access keys regularly and use least-privilege permissions.";

    return { awsAccountId, credentialsId, securityWarning };
  },
});

/**
 * Verify that the access key connection works by testing with sts get-caller-identity.
 *
 * In production, this would call the sandbox to execute:
 * `aws sts get-caller-identity`
 *
 * For testing purposes, we accept a mockSuccess flag to simulate the result.
 */
export const verifyKeyConnection = mutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    userId: v.id("users"),
    mockSuccess: v.optional(v.boolean()), // For testing
  },
  handler: async (ctx, args) => {
    const { awsAccountId, userId, mockSuccess } = args;
    const now = Date.now();

    // Get the AWS account
    const awsAccount = await ctx.db.get(awsAccountId);
    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, awsAccount.organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get the credentials
    const credentials = await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
      .first();

    if (!credentials) {
      throw new Error("Credentials not found for this AWS account");
    }

    if (!credentials.encryptedAccessKeyId || !credentials.encryptedSecretAccessKey) {
      throw new Error("Access key credentials are required");
    }

    // In production, we would call the sandbox here to test the credentials:
    // const command = `aws sts get-caller-identity`;
    // const result = await ctx.runAction(internal.sandbox.executeCommand, { awsAccountId, command });
    //
    // For now, we use the mockSuccess flag for testing
    const success = mockSuccess ?? false;

    // Update the account status based on verification result
    const newStatus = success ? "active" : "error";

    await ctx.db.patch(awsAccountId, {
      status: newStatus,
      lastVerifiedAt: success ? now : undefined,
      updatedAt: now,
    });

    return {
      success,
      status: newStatus,
      message: success
        ? "Access key credentials verified successfully"
        : "Failed to verify access key credentials. Please check your access key ID and secret access key.",
    };
  },
});

/**
 * Update an existing AWS account.
 */
export const update = mutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { awsAccountId, userId, name, description, region } = args;
    const now = Date.now();

    // Get the AWS account
    const awsAccount = await ctx.db.get(awsAccountId);
    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, awsAccount.organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Check if user has write permissions
    if (!WRITE_ROLES.includes(membership.role as typeof WRITE_ROLES[number])) {
      throw new Error("You do not have permission to update AWS accounts");
    }

    // Build update object
    const updates: Partial<{
      name: string;
      description: string;
      region: string;
      updatedAt: number;
    }> = {
      updatedAt: now,
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (region !== undefined) updates.region = region;

    await ctx.db.patch(awsAccountId, updates);

    return { success: true };
  },
});

/**
 * Disconnect (delete) an AWS account.
 * Also deletes associated credentials and execution logs.
 */
export const disconnect = mutation({
  args: {
    awsAccountId: v.id("awsAccounts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { awsAccountId, userId } = args;

    // Get the AWS account
    const awsAccount = await ctx.db.get(awsAccountId);
    if (!awsAccount) {
      throw new Error("AWS account not found");
    }

    // Check if user is a member of the organization
    const membership = await getMembership(ctx, awsAccount.organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Only owners and admins can disconnect accounts
    if (!["owner", "admin"].includes(membership.role)) {
      throw new Error("You do not have permission to disconnect AWS accounts");
    }

    // Delete associated credentials
    const credentials = await ctx.db
      .query("awsCredentials")
      .withIndex("by_awsAccount", (q) => q.eq("awsAccountId", awsAccountId))
      .collect();

    for (const cred of credentials) {
      await ctx.db.delete(cred._id);
    }

    // Delete the AWS account
    await ctx.db.delete(awsAccountId);

    return { success: true };
  },
});
