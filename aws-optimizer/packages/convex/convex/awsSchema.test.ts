/**
 * AWS Integration Schema Tests
 *
 * Tests for AWS-related tables: awsAccounts, awsCredentials, sandboxExecutions.
 * Validates that the schema correctly supports AWS account connections and execution logs.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex } from "../test.setup";
import {
  createMockOrganization,
  createMockAwsAccount,
  createMockAwsCredentials,
  createMockSandboxExecution,
  type AwsAccountStatus,
  type AwsConnectionType,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("AWS Integration Schema", () => {
  describe("awsAccounts Table", () => {
    it("should create an AWS account with required fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t, { name: "Test Org" });
      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Production Account",
        accountNumber: "123456789012",
        connectionType: "iam_role",
        status: "active",
      });

      expect(awsAccount._id).toBeDefined();
      expect(awsAccount.organizationId).toBe(org._id);
      expect(awsAccount.name).toBe("Production Account");
      expect(awsAccount.accountNumber).toBe("123456789012");
      expect(awsAccount.connectionType).toBe("iam_role");
      expect(awsAccount.status).toBe("active");
      expect(awsAccount.createdAt).toBeDefined();
      expect(awsAccount.updatedAt).toBeDefined();
    });

    it("should support all connection types", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const connectionTypes: AwsConnectionType[] = ["iam_role", "access_key", "sso"];

      for (const connectionType of connectionTypes) {
        const awsAccount = await createMockAwsAccount(t, {
          organizationId: org._id,
          connectionType,
        });
        expect(awsAccount.connectionType).toBe(connectionType);
      }
    });

    it("should support all status values", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);
      const statuses: AwsAccountStatus[] = ["active", "inactive", "pending", "error"];

      for (const status of statuses) {
        const awsAccount = await createMockAwsAccount(t, {
          organizationId: org._id,
          status,
        });
        expect(awsAccount.status).toBe(status);
      }
    });

    it("should query AWS accounts by organization index", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { slug: "org-1" });
      const org2 = await createMockOrganization(t, { slug: "org-2" });

      await createMockAwsAccount(t, { organizationId: org1._id, name: "Account 1" });
      await createMockAwsAccount(t, { organizationId: org1._id, name: "Account 2" });
      await createMockAwsAccount(t, { organizationId: org2._id, name: "Account 3" });

      const org1Accounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      expect(org1Accounts.length).toBe(2);
    });

    it("should query AWS accounts by status index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAwsAccount(t, { organizationId: org._id, status: "active" });
      await createMockAwsAccount(t, { organizationId: org._id, status: "active" });
      await createMockAwsAccount(t, { organizationId: org._id, status: "error" });

      const activeAccounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsAccounts")
          .withIndex("by_status", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("status", "active")
          )
          .collect();
      });

      expect(activeAccounts.length).toBe(2);
    });

    it("should query AWS accounts by account number index", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t);

      await createMockAwsAccount(t, {
        organizationId: org._id,
        accountNumber: "111122223333",
      });

      const foundAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsAccounts")
          .withIndex("by_accountNumber", (q: { eq: (field: string, value: string) => unknown }) =>
            q.eq("accountNumber", "111122223333")
          )
          .first();
      });

      expect(foundAccount).toBeDefined();
      expect(foundAccount?.accountNumber).toBe("111122223333");
    });
  });

  describe("awsCredentials Table", () => {
    it("should create AWS credentials with encrypted fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const credentials = await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        encryptedAccessKeyId: "encrypted-access-key-id",
        encryptedSecretAccessKey: "encrypted-secret-key",
        roleArn: "arn:aws:iam::123456789012:role/CostOptimizerRole",
      });

      expect(credentials._id).toBeDefined();
      expect(credentials.awsAccountId).toBe(awsAccount._id);
      expect(credentials.encryptedAccessKeyId).toBe("encrypted-access-key-id");
      expect(credentials.encryptedSecretAccessKey).toBe("encrypted-secret-key");
      expect(credentials.roleArn).toBe("arn:aws:iam::123456789012:role/CostOptimizerRole");
      expect(credentials.createdAt).toBeDefined();
      expect(credentials.updatedAt).toBeDefined();
    });

    it("should support optional fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const credentials = await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        roleArn: "arn:aws:iam::123456789012:role/ReadOnlyRole",
        externalId: "external-id-123",
        sessionDuration: 3600,
      });

      expect(credentials.roleArn).toBe("arn:aws:iam::123456789012:role/ReadOnlyRole");
      expect(credentials.externalId).toBe("external-id-123");
      expect(credentials.sessionDuration).toBe(3600);
    });

    it("should query credentials by AWS account index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockAwsCredentials(t, { awsAccountId: awsAccount1._id });
      await createMockAwsCredentials(t, { awsAccountId: awsAccount2._id });

      const account1Credentials = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsCredentials")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .first();
      });

      expect(account1Credentials).toBeDefined();
      expect(account1Credentials?.awsAccountId).toBe(awsAccount1._id);
    });
  });

  describe("sandboxExecutions Table", () => {
    it("should create a sandbox execution with all fields", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const execution = await createMockSandboxExecution(t, {
        awsAccountId: awsAccount._id,
        command: "aws ec2 describe-instances",
        stdout: '{"Reservations": []}',
        stderr: "",
        exitCode: 0,
        executionTime: 1250,
      });

      expect(execution._id).toBeDefined();
      expect(execution.awsAccountId).toBe(awsAccount._id);
      expect(execution.command).toBe("aws ec2 describe-instances");
      expect(execution.stdout).toBe('{"Reservations": []}');
      expect(execution.stderr).toBe("");
      expect(execution.exitCode).toBe(0);
      expect(execution.executionTime).toBe(1250);
      expect(execution.createdAt).toBeDefined();
    });

    it("should support failed executions", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });
      const execution = await createMockSandboxExecution(t, {
        awsAccountId: awsAccount._id,
        command: "aws s3 ls s3://nonexistent-bucket",
        stdout: "",
        stderr: "An error occurred (NoSuchBucket)",
        exitCode: 1,
        executionTime: 500,
      });

      expect(execution.exitCode).toBe(1);
      expect(execution.stderr).toContain("NoSuchBucket");
    });

    it("should query executions by AWS account index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount1 = await createMockAwsAccount(t, { organizationId: org._id });
      const awsAccount2 = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockSandboxExecution(t, { awsAccountId: awsAccount1._id, command: "cmd1" });
      await createMockSandboxExecution(t, { awsAccountId: awsAccount1._id, command: "cmd2" });
      await createMockSandboxExecution(t, { awsAccountId: awsAccount2._id, command: "cmd3" });

      const account1Executions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("sandboxExecutions")
          .withIndex("by_awsAccount", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount1._id)
          )
          .collect();
      });

      expect(account1Executions.length).toBe(2);
    });

    it("should query executions by createdAt index for time-based queries", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockSandboxExecution(t, { awsAccountId: awsAccount._id });
      await createMockSandboxExecution(t, { awsAccountId: awsAccount._id });

      const recentExecutions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("sandboxExecutions")
          .withIndex("by_createdAt")
          .order("desc")
          .take(10);
      });

      expect(recentExecutions.length).toBe(2);
    });

    it("should query executions by account and time combined index", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      await createMockSandboxExecution(t, { awsAccountId: awsAccount._id });
      await createMockSandboxExecution(t, { awsAccountId: awsAccount._id });

      const accountExecutions = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("sandboxExecutions")
          .withIndex("by_awsAccount_createdAt", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("awsAccountId", awsAccount._id)
          )
          .order("desc")
          .collect();
      });

      expect(accountExecutions.length).toBe(2);
    });
  });

  describe("AWS Integration Multi-tenancy", () => {
    it("should isolate AWS accounts between organizations", async () => {
      const t = createTestConvex();

      const org1 = await createMockOrganization(t, { name: "Org 1", slug: "org-1" });
      const org2 = await createMockOrganization(t, { name: "Org 2", slug: "org-2" });

      await createMockAwsAccount(t, { organizationId: org1._id, name: "Org1 Account" });
      await createMockAwsAccount(t, { organizationId: org2._id, name: "Org2 Account" });

      const org1Accounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org1._id)
          )
          .collect();
      });

      const org2Accounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("awsAccounts")
          .withIndex("by_organization", (q: { eq: (field: string, value: unknown) => unknown }) =>
            q.eq("organizationId", org2._id)
          )
          .collect();
      });

      expect(org1Accounts.length).toBe(1);
      expect(org1Accounts[0].name).toBe("Org1 Account");
      expect(org2Accounts.length).toBe(1);
      expect(org2Accounts[0].name).toBe("Org2 Account");
    });

    it("should link credentials and executions to specific AWS accounts", async () => {
      const t = createTestConvex();

      const org = await createMockOrganization(t);
      const awsAccount = await createMockAwsAccount(t, { organizationId: org._id });

      const credentials = await createMockAwsCredentials(t, {
        awsAccountId: awsAccount._id,
        roleArn: "arn:aws:iam::123456789012:role/TestRole",
      });

      const execution = await createMockSandboxExecution(t, {
        awsAccountId: awsAccount._id,
        command: "aws sts get-caller-identity",
      });

      expect(credentials.awsAccountId).toBe(awsAccount._id);
      expect(execution.awsAccountId).toBe(awsAccount._id);
    });
  });
});
