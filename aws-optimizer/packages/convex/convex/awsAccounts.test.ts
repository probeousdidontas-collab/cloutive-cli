/**
 * AWS Accounts Tests
 *
 * Tests for US-012: Implement AWS account connection - IAM role
 *
 * Tests the connectWithRole mutation which:
 * - Accepts roleArn and externalId parameters
 * - Creates AWS account with 'iam_role' connection type
 * - Stores credentials with roleArn and externalId
 * - Generates CloudFormation template for role creation
 * - Tests role assumption via sandbox
 */

import { describe, it, expect } from "vitest";
import { createTestConvex, type TestCtx } from "../test.setup";
import {
  createMockOrganization,
  createMockUser,
  createMockOrgMember,
  createMockAwsAccount,
  createMockAwsCredentials,
} from "./test.helpers";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Helper to create an authenticated user with organization membership.
 * Used for testing mutations that require auth context.
 */
async function createAuthenticatedUser(t: ReturnType<typeof createTestConvex>): Promise<{
  organizationId: Id<"organizations">;
  userId: Id<"users">;
}> {
  const now = Date.now();
  
  const organizationId = await t.run(async (ctx: AnyCtx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: `test-org-${now}`,
      plan: "free",
      settings: {},
      createdAt: now,
      updatedAt: now,
    });
  });

  const userId = await t.run(async (ctx: AnyCtx) => {
    return await ctx.db.insert("users", {
      email: `user-${now}@example.com`,
      name: "Test User",
      role: "user",
      status: "active",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  await t.run(async (ctx: AnyCtx) => {
    return await ctx.db.insert("orgMembers", {
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
  });

  return { organizationId, userId };
}

// Type assertion helper for convex-test
type AnyCtx = TestCtx;

describe("AWS Accounts - Access Key Connection (US-013)", () => {
  describe("connectWithKeys mutation", () => {
    it("should create AWS account with access_key connection type", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const user = await createMockUser(t, { email: "user@example.com" });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const result = await t.mutation(api.awsAccounts.connectWithKeys, {
        organizationId: org._id,
        userId: user._id,
        name: "Production Account",
        accountNumber: "123456789012",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      expect(result.awsAccountId).toBeDefined();
      expect(result.credentialsId).toBeDefined();
      expect(result.securityWarning).toBeDefined();
      expect(result.securityWarning).toContain("less secure");

      // Verify the AWS account was created correctly
      const awsAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.awsAccountId);
      });

      expect(awsAccount).toBeDefined();
      expect(awsAccount.name).toBe("Production Account");
      expect(awsAccount.accountNumber).toBe("123456789012");
      expect(awsAccount.connectionType).toBe("access_key");
      expect(awsAccount.status).toBe("pending");
      expect(awsAccount.organizationId).toBe(org._id);
    });

    it("should encrypt credentials before storing", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "admin",
      });

      const result = await t.mutation(api.awsAccounts.connectWithKeys, {
        organizationId: org._id,
        userId: user._id,
        name: "Dev Account",
        accountNumber: "987654321098",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      // Verify credentials were stored encrypted
      const credentials = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsCredentials")
          .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", result.awsAccountId))
          .first();
      });

      expect(credentials).toBeDefined();
      expect(credentials.encryptedAccessKeyId).toBeDefined();
      expect(credentials.encryptedSecretAccessKey).toBeDefined();
      // Credentials should be encrypted (prefixed with "encrypted-")
      expect(credentials.encryptedAccessKeyId).toContain("encrypted-");
      expect(credentials.encryptedSecretAccessKey).toContain("encrypted-");
      // Original values should not be stored directly
      expect(credentials.encryptedAccessKeyId).not.toBe("AKIAIOSFODNN7EXAMPLE");
      expect(credentials.encryptedSecretAccessKey).not.toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    });

    it("should reject invalid AWS account number", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithKeys, {
          organizationId: org._id,
          userId: user._id,
          name: "Bad Account",
          accountNumber: "12345", // Too short
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
        })
      ).rejects.toThrow("AWS account number must be exactly 12 digits");
    });

    it("should reject invalid access key ID format", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithKeys, {
          organizationId: org._id,
          userId: user._id,
          name: "Bad Account",
          accountNumber: "123456789012",
          accessKeyId: "invalid-key", // Invalid format
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
        })
      ).rejects.toThrow("Invalid AWS access key ID format");
    });

    it("should require user to be a member of the organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      // Note: user is NOT added as a member

      await expect(
        t.mutation(api.awsAccounts.connectWithKeys, {
          organizationId: org._id,
          userId: user._id,
          name: "Account",
          accountNumber: "123456789012",
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
        })
      ).rejects.toThrow("You are not a member of this organization");
    });

    it("should allow members with write permissions to connect accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      const result = await t.mutation(api.awsAccounts.connectWithKeys, {
        organizationId: org._id,
        userId: user._id,
        name: "Member Account",
        accountNumber: "111122223333",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
      });

      expect(result.awsAccountId).toBeDefined();
    });

    it("should reject viewers from connecting accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithKeys, {
          organizationId: org._id,
          userId: user._id,
          name: "Viewer Account",
          accountNumber: "123456789012",
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
        })
      ).rejects.toThrow("You do not have permission to connect AWS accounts");
    });

    it("should include optional description and region", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const result = await t.mutation(api.awsAccounts.connectWithKeys, {
        organizationId: org._id,
        userId: user._id,
        name: "EU Account",
        accountNumber: "444455556666",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
        description: "Development account for EU region",
        region: "eu-west-1",
      });

      const awsAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.awsAccountId);
      });

      expect(awsAccount.description).toBe("Development account for EU region");
      expect(awsAccount.region).toBe("eu-west-1");
    });

    it("should return security warning about key-based access", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const result = await t.mutation(api.awsAccounts.connectWithKeys, {
        organizationId: org._id,
        userId: user._id,
        name: "Test Account",
        accountNumber: "123456789012",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
      });

      expect(result.securityWarning).toBeDefined();
      expect(result.securityWarning).toContain("IAM role");
    });
  });

  describe("verifyKeyConnection mutation", () => {
    it("should update status to 'active' when sts get-caller-identity succeeds", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      // Create an AWS account with access_key connection type
      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Test Account",
        accountNumber: "123456789012",
        connectionType: "access_key",
        status: "pending",
      });

      await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        encryptedAccessKeyId: "encrypted-AKIAIOSFODNN7EXAMPLE",
        encryptedSecretAccessKey: "encrypted-wJalrXUtnFEMI/K7MDENG",
      });

      // Mock verification - in real implementation this would call sandbox
      const result = await t.mutation(api.awsAccounts.verifyKeyConnection, {
        awsAccountId: awsAccount._id,
        userId: user._id,
        mockSuccess: true, // Test helper flag
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("active");

      // Verify the account status was updated
      const updatedAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(awsAccount._id);
      });

      expect(updatedAccount.status).toBe("active");
      expect(updatedAccount.lastVerifiedAt).toBeDefined();
    });

    it("should update status to 'error' when sts get-caller-identity fails", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        connectionType: "access_key",
        status: "pending",
      });

      await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        encryptedAccessKeyId: "encrypted-AKIAINVALIDKEY",
        encryptedSecretAccessKey: "encrypted-invalidSecret",
      });

      const result = await t.mutation(api.awsAccounts.verifyKeyConnection, {
        awsAccountId: awsAccount._id,
        userId: user._id,
        mockSuccess: false,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("error");

      const updatedAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(awsAccount._id);
      });

      expect(updatedAccount.status).toBe("error");
    });

    it("should require credentials to exist before verification", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        connectionType: "access_key",
        status: "pending",
      });
      // Note: No credentials created

      await expect(
        t.mutation(api.awsAccounts.verifyKeyConnection, {
          awsAccountId: awsAccount._id,
          userId: user._id,
        })
      ).rejects.toThrow("Credentials not found for this AWS account");
    });

    it("should require access key credentials for verification", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        connectionType: "access_key",
        status: "pending",
      });

      // Create credentials without access key fields (only role ARN)
      await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        roleArn: "arn:aws:iam::123456789012:role/TestRole",
        externalId: "test-external-id",
      });

      await expect(
        t.mutation(api.awsAccounts.verifyKeyConnection, {
          awsAccountId: awsAccount._id,
          userId: user._id,
        })
      ).rejects.toThrow("Access key credentials are required");
    });
  });
});

describe("connectWithCredentialsFile mutation", () => {
  it("should connect account with parsed credentials file", async () => {
    const t = createTestConvex();
    const { organizationId, userId } = await createAuthenticatedUser(t);

    const result = await t.mutation(api.awsAccounts.connectWithCredentialsFile, {
      organizationId,
      userId,
      name: "Dev Account",
      accountNumber: "123456789012",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      sourceProfile: "default",
      sourceFormat: "ini",
      region: "us-east-1",
    });

    expect(result.awsAccountId).toBeDefined();
    expect(result.credentialsId).toBeDefined();
    expect(result.isTemporary).toBe(false);

    // Verify account was created
    const account = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.get(result.awsAccountId);
    });

    expect(account?.connectionType).toBe("credentials_file");
    expect(account?.status).toBe("pending");
  });

  it("should detect temporary credentials with session token", async () => {
    const t = createTestConvex();
    const { organizationId, userId } = await createAuthenticatedUser(t);

    const result = await t.mutation(api.awsAccounts.connectWithCredentialsFile, {
      organizationId,
      userId,
      name: "Temp Account",
      accountNumber: "123456789012",
      accessKeyId: "ASIAZXCVBNM1234TEMP",
      secretAccessKey: "secret",
      sessionToken: "session-token-123",
      sourceProfile: "temp",
      sourceFormat: "json",
    });

    expect(result.isTemporary).toBe(true);
    expect(result.warning).toContain("temporary credentials");
  });

  it("should store source profile and format", async () => {
    const t = createTestConvex();
    const { organizationId, userId } = await createAuthenticatedUser(t);

    const result = await t.mutation(api.awsAccounts.connectWithCredentialsFile, {
      organizationId,
      userId,
      name: "Test Account",
      accountNumber: "123456789012",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "secret",
      sourceProfile: "production",
      sourceFormat: "env",
    });

    // Verify credentials have source info
    const credentials = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db
        .query("awsCredentials")
        .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", result.awsAccountId))
        .first();
    });

    expect(credentials?.sourceProfile).toBe("production");
    expect(credentials?.sourceFormat).toBe("env");
  });

  it("should track credential expiry", async () => {
    const t = createTestConvex();
    const { organizationId, userId } = await createAuthenticatedUser(t);
    const expiresAt = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days from now

    const result = await t.mutation(api.awsAccounts.connectWithCredentialsFile, {
      organizationId,
      userId,
      name: "Expiring Account",
      accountNumber: "123456789012",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "secret",
      sourceProfile: "default",
      sourceFormat: "json",
      expiresAt,
    });

    const credentials = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db
        .query("awsCredentials")
        .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", result.awsAccountId))
        .first();
    });

    expect(credentials?.expiresAt).toBe(expiresAt);
    expect(credentials?.validationStatus).toBe("expiring");
  });
});

describe("AWS Accounts - IAM Role Connection", () => {
  describe("connectWithRole mutation", () => {
    it("should create AWS account with IAM role connection type", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const user = await createMockUser(t, { email: "user@example.com" });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const result = await t.mutation(api.awsAccounts.connectWithRole, {
        organizationId: org._id,
        userId: user._id,
        name: "Production Account",
        accountNumber: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/CostOptimizerRole",
        externalId: "unique-external-id-123",
      });

      expect(result.awsAccountId).toBeDefined();
      expect(result.credentialsId).toBeDefined();

      // Verify the AWS account was created correctly
      const awsAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.awsAccountId);
      });

      expect(awsAccount).toBeDefined();
      expect(awsAccount.name).toBe("Production Account");
      expect(awsAccount.accountNumber).toBe("123456789012");
      expect(awsAccount.connectionType).toBe("iam_role");
      expect(awsAccount.status).toBe("pending");
      expect(awsAccount.organizationId).toBe(org._id);
    });

    it("should store credentials with roleArn and externalId", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "admin",
      });

      const result = await t.mutation(api.awsAccounts.connectWithRole, {
        organizationId: org._id,
        userId: user._id,
        name: "Dev Account",
        accountNumber: "987654321098",
        roleArn: "arn:aws:iam::987654321098:role/DevRole",
        externalId: "dev-external-id",
        sessionDuration: 3600,
      });

      // Verify credentials were stored correctly
      const credentials = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsCredentials")
          .withIndex("by_awsAccount", (q: AnyCtx) => q.eq("awsAccountId", result.awsAccountId))
          .first();
      });

      expect(credentials).toBeDefined();
      expect(credentials.roleArn).toBe("arn:aws:iam::987654321098:role/DevRole");
      expect(credentials.externalId).toBe("dev-external-id");
      expect(credentials.sessionDuration).toBe(3600);
    });

    it("should reject invalid roleArn format", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithRole, {
          organizationId: org._id,
          userId: user._id,
          name: "Bad Account",
          accountNumber: "123456789012",
          roleArn: "invalid-role-arn",
          externalId: "external-id",
        })
      ).rejects.toThrow("Invalid IAM role ARN format");
    });

    it("should reject invalid AWS account number", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithRole, {
          organizationId: org._id,
          userId: user._id,
          name: "Bad Account",
          accountNumber: "12345", // Too short
          roleArn: "arn:aws:iam::123456789012:role/TestRole",
          externalId: "external-id",
        })
      ).rejects.toThrow("AWS account number must be exactly 12 digits");
    });

    it("should require user to be a member of the organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      // Note: user is NOT added as a member

      await expect(
        t.mutation(api.awsAccounts.connectWithRole, {
          organizationId: org._id,
          userId: user._id,
          name: "Account",
          accountNumber: "123456789012",
          roleArn: "arn:aws:iam::123456789012:role/TestRole",
          externalId: "external-id",
        })
      ).rejects.toThrow("You are not a member of this organization");
    });

    it("should allow members with write permissions to connect accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member", // members have write permissions
      });

      const result = await t.mutation(api.awsAccounts.connectWithRole, {
        organizationId: org._id,
        userId: user._id,
        name: "Member Account",
        accountNumber: "111122223333",
        roleArn: "arn:aws:iam::111122223333:role/MemberRole",
        externalId: "member-external-id",
      });

      expect(result.awsAccountId).toBeDefined();
    });

    it("should reject viewers from connecting accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "viewer",
      });

      await expect(
        t.mutation(api.awsAccounts.connectWithRole, {
          organizationId: org._id,
          userId: user._id,
          name: "Viewer Account",
          accountNumber: "123456789012",
          roleArn: "arn:aws:iam::123456789012:role/TestRole",
          externalId: "external-id",
        })
      ).rejects.toThrow("You do not have permission to connect AWS accounts");
    });

    it("should include optional description and region", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const result = await t.mutation(api.awsAccounts.connectWithRole, {
        organizationId: org._id,
        userId: user._id,
        name: "EU Account",
        accountNumber: "444455556666",
        roleArn: "arn:aws:iam::444455556666:role/EURole",
        externalId: "eu-external-id",
        description: "Production account for EU region",
        region: "eu-west-1",
      });

      const awsAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(result.awsAccountId);
      });

      expect(awsAccount.description).toBe("Production account for EU region");
      expect(awsAccount.region).toBe("eu-west-1");
    });
  });

  describe("generateCloudFormationTemplate query", () => {
    it("should generate CloudFormation template with correct parameters", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsAccounts.generateCloudFormationTemplate, {
        externalId: "unique-external-id-456",
        roleName: "CostOptimizerRole",
      });

      expect(result.template).toBeDefined();
      expect(result.template).toContain("AWSTemplateFormatVersion");
      expect(result.template).toContain("unique-external-id-456");
      expect(result.template).toContain("CostOptimizerRole");
      expect(result.template).toContain("sts:AssumeRole");
    });

    it("should use default role name if not provided", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsAccounts.generateCloudFormationTemplate, {
        externalId: "test-external-id",
      });

      expect(result.template).toContain("AWSCostOptimizerRole");
    });

    it("should include ReadOnlyAccess policy in template", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsAccounts.generateCloudFormationTemplate, {
        externalId: "test-external-id",
      });

      expect(result.template).toContain("ReadOnlyAccess");
    });
  });

  describe("verifyRoleConnection mutation", () => {
    it("should update status to 'active' when role assumption succeeds", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      // First create an AWS account
      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Test Account",
        accountNumber: "123456789012",
        connectionType: "iam_role",
        status: "pending",
      });

      await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        roleArn: "arn:aws:iam::123456789012:role/TestRole",
        externalId: "test-external-id",
      });

      // Mock verification - in real implementation this would call sandbox
      // For now we test the mutation interface
      const result = await t.mutation(api.awsAccounts.verifyRoleConnection, {
        awsAccountId: awsAccount._id,
        userId: user._id,
        mockSuccess: true, // Test helper flag
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("active");

      // Verify the account status was updated
      const updatedAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(awsAccount._id);
      });

      expect(updatedAccount.status).toBe("active");
      expect(updatedAccount.lastVerifiedAt).toBeDefined();
    });

    it("should update status to 'error' when role assumption fails", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        connectionType: "iam_role",
        status: "pending",
      });

      await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        roleArn: "arn:aws:iam::123456789012:role/InvalidRole",
        externalId: "invalid-external-id",
      });

      const result = await t.mutation(api.awsAccounts.verifyRoleConnection, {
        awsAccountId: awsAccount._id,
        userId: user._id,
        mockSuccess: false,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("error");

      const updatedAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(awsAccount._id);
      });

      expect(updatedAccount.status).toBe("error");
    });

    it("should require credentials to exist before verification", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        connectionType: "iam_role",
        status: "pending",
      });
      // Note: No credentials created

      await expect(
        t.mutation(api.awsAccounts.verifyRoleConnection, {
          awsAccountId: awsAccount._id,
          userId: user._id,
        })
      ).rejects.toThrow("Credentials not found for this AWS account");
    });
  });

  describe("getById query", () => {
    it("should return AWS account by ID for authorized users", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "My Account",
        connectionType: "iam_role",
      });

      const result = await t.query(api.awsAccounts.getById, {
        awsAccountId: awsAccount._id,
        userId: user._id,
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("My Account");
      expect(result?.connectionType).toBe("iam_role");
    });

    it("should return null for non-existent account", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "member",
      });

      // Create and then delete an account to get a valid but non-existent ID
      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
      });

      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.delete(awsAccount._id);
      });

      const result = await t.query(api.awsAccounts.getById, {
        awsAccountId: awsAccount._id,
        userId: user._id,
      });

      expect(result).toBeNull();
    });
  });

  describe("listByOrganization query", () => {
    it("should list all AWS accounts for an organization", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "viewer",
      });

      await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Account 1",
        connectionType: "iam_role",
      });
      await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Account 2",
        connectionType: "access_key",
      });

      const result = await t.query(api.awsAccounts.listByOrganization, {
        organizationId: org._id,
        userId: user._id,
      });

      expect(result.length).toBe(2);
      expect(result.map((a: { name: string }) => a.name)).toContain("Account 1");
      expect(result.map((a: { name: string }) => a.name)).toContain("Account 2");
    });

    it("should not show accounts from other organizations", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org1._id,
        userId: user._id,
        role: "member",
      });

      await createMockAwsAccount(t, {
        organizationId: org1._id,
        name: "Org1 Account",
      });
      await createMockAwsAccount(t, {
        organizationId: org2._id,
        name: "Org2 Account",
      });

      const result = await t.query(api.awsAccounts.listByOrganization, {
        organizationId: org1._id,
        userId: user._id,
      });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Org1 Account");
    });
  });
});
