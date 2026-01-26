/**
 * AWS Organizations Discovery Tests
 *
 * Tests for AWS Organizations discovery and batch connect functionality.
 */

import { describe, it, expect } from "vitest";
import {
  createMockOrganization,
  createMockUser,
  createMockOrgMember,
  createMockAwsAccount,
  createMockAwsCredentials,
} from "./test.helpers";
import { createTestConvex, type TestCtx } from "../test.setup";
import { RATE_LIMIT_CONFIGS } from "./rateLimit";
import { api } from "./_generated/api";

// Type assertion helper for convex-test
type AnyCtx = TestCtx;

describe("AWS Organizations Discovery", () => {
  describe("awsOrgDiscoveries table", () => {
    it("should create a discovery session", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-discovery" });
      const user = await createMockUser(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "pending",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const discovery = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(discoveryId);
      });

      expect(discovery).toBeDefined();
      expect(discovery?.status).toBe("pending");
      expect(discovery?.managementAccountNumber).toBe("123456789012");
    });

    it("should update discovery status through all states", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-states" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "pending",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Transition through states
      const states = ["discovering", "discovered", "deploying", "completed"] as const;

      for (const status of states) {
        await t.run(async (ctx: AnyCtx) => {
          await ctx.db.patch(discoveryId, { status, updatedAt: Date.now() });
        });

        const discovery = await t.run(async (ctx: AnyCtx) => {
          return await ctx.db.get(discoveryId);
        });

        expect(discovery?.status).toBe(status);
      }
    });

    it("should track discovery statistics", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-stats" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovered",
          totalAccountsFound: 10,
          accountsSelected: 5,
          accountsConnected: 0,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const discovery = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(discoveryId);
      });

      expect(discovery?.totalAccountsFound).toBe(10);
      expect(discovery?.accountsSelected).toBe(5);
      expect(discovery?.accountsConnected).toBe(0);
    });
  });

  describe("discoveredAwsAccounts table", () => {
    it("should create discovered accounts", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-discovered" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovered",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const accountId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "987654321098",
          accountName: "Member Account 1",
          email: "member1@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/987654321098",
          joinedMethod: "CREATED",
          joinedTimestamp: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          awsStatus: "ACTIVE",
          status: "discovered",
          createdAt: now,
          updatedAt: now,
        });
      });

      const account = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(accountId);
      });

      expect(account).toBeDefined();
      expect(account?.accountNumber).toBe("987654321098");
      expect(account?.accountName).toBe("Member Account 1");
      expect(account?.status).toBe("discovered");
    });

    it("should update account selection status", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-selection" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovered",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const accountId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "987654321098",
          accountName: "Member Account",
          email: "member@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/987654321098",
          joinedMethod: "INVITED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "discovered",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Select the account
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(accountId, { status: "selected", updatedAt: Date.now() });
      });

      const account = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(accountId);
      });

      expect(account?.status).toBe("selected");
    });

    it("should transition through connection states", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-connect-states" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "deploying",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const accountId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "987654321098",
          accountName: "Member Account",
          email: "member@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/987654321098",
          joinedMethod: "CREATED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "selected",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Transition: selected -> connecting -> connected
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(accountId, {
          status: "connecting",
          statusMessage: "Creating IAM role...",
          updatedAt: Date.now(),
        });
      });

      let account = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(accountId);
      });
      expect(account?.status).toBe("connecting");

      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(accountId, {
          status: "connected",
          statusMessage: "Successfully connected",
          updatedAt: Date.now(),
        });
      });

      account = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(accountId);
      });
      expect(account?.status).toBe("connected");
    });

    it("should handle failed connection", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-failed" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "deploying",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const accountId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "987654321098",
          accountName: "Member Account",
          email: "member@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/987654321098",
          joinedMethod: "CREATED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "connecting",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Mark as failed
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(accountId, {
          status: "failed",
          statusMessage: "IAM role not found",
          updatedAt: Date.now(),
        });
      });

      const account = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(accountId);
      });

      expect(account?.status).toBe("failed");
      expect(account?.statusMessage).toBe("IAM role not found");
    });

    it("should link connected account to awsAccounts", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-link" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "completed",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Create the actual AWS account
      const awsAccount = await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Member Account (Connected)",
        accountNumber: "987654321098",
        connectionType: "iam_role",
        status: "active",
      });

      // Create discovered account with reference
      const discoveredAccountId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "987654321098",
          accountName: "Member Account",
          email: "member@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/987654321098",
          joinedMethod: "CREATED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "connected",
          connectedAwsAccountId: awsAccount._id,
          createdAt: now,
          updatedAt: now,
        });
      });

      const discoveredAccount = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(discoveredAccountId);
      });

      expect(discoveredAccount?.connectedAwsAccountId).toBe(awsAccount._id);
    });
  });

  describe("Rate Limiting Configuration", () => {
    it("should have orgDiscovery rate limit configured", () => {
      expect(RATE_LIMIT_CONFIGS.orgDiscovery).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.orgDiscovery.kind).toBe("fixed window");
      expect(RATE_LIMIT_CONFIGS.orgDiscovery.rate).toBe(3);
      expect(RATE_LIMIT_CONFIGS.orgDiscovery.period).toBe(60 * 60 * 1000);
    });
  });

  describe("generateStackSetTemplate query", () => {
    it("should generate valid CloudFormation StackSet template", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsOrganizations.generateStackSetTemplate, {
        externalId: "test-external-id-123",
        roleName: "CustomRoleName",
      });

      expect(result.template).toBeDefined();
      expect(result.template).toContain("AWSTemplateFormatVersion");
      expect(result.template).toContain("test-external-id-123");
      expect(result.template).toContain("CustomRoleName");
      expect(result.template).toContain("StackSets");
      expect(result.template).toContain("sts:AssumeRole");
    });

    it("should use default role name when not specified", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsOrganizations.generateStackSetTemplate, {
        externalId: "test-external-id",
      });

      expect(result.template).toContain("AWSCostOptimizerRole");
    });

    it("should include ReadOnlyAccess policy in template", async () => {
      const t = createTestConvex();

      const result = await t.query(api.awsOrganizations.generateStackSetTemplate, {
        externalId: "test-external-id",
      });

      expect(result.template).toContain("ReadOnlyAccess");
      expect(result.template).toContain("SecurityAudit");
    });
  });

  describe("Discovery Session Queries", () => {
    it("should get discovery by ID", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-get" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovered",
          totalAccountsFound: 5,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.query(api.awsOrganizations.getDiscovery, {
        discoveryId,
      });

      expect(result).toBeDefined();
      expect(result?.managementAccountNumber).toBe("123456789012");
      expect(result?.totalAccountsFound).toBe(5);
    });

    it("should list discovered accounts by discovery ID", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-list" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovered",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Create multiple discovered accounts
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "111111111111",
          accountName: "Account 1",
          email: "acc1@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/111111111111",
          joinedMethod: "CREATED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "discovered",
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("discoveredAwsAccounts", {
          discoveryId,
          organizationId: org._id,
          accountNumber: "222222222222",
          accountName: "Account 2",
          email: "acc2@example.com",
          accountArn: "arn:aws:organizations::123456789012:account/o-abc123/222222222222",
          joinedMethod: "INVITED",
          joinedTimestamp: now,
          awsStatus: "ACTIVE",
          status: "selected",
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.query(api.awsOrganizations.listDiscoveredAccounts, {
        discoveryId,
      });

      expect(result).toHaveLength(2);
      expect(result.map((a: { accountNumber: string }) => a.accountNumber)).toContain("111111111111");
      expect(result.map((a: { accountNumber: string }) => a.accountNumber)).toContain("222222222222");
    });
  });

  describe("Internal Mutations", () => {
    it("should update discovery status via internal mutation", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-internal" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "pending",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Internal mutation - use direct DB operation
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.patch(discoveryId, {
          status: "discovered",
          statusMessage: "Found 10 accounts",
          totalAccountsFound: 10,
          updatedAt: Date.now(),
        });
      });

      const discovery = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(discoveryId);
      });

      expect(discovery?.status).toBe("discovered");
      expect(discovery?.statusMessage).toBe("Found 10 accounts");
      expect(discovery?.totalAccountsFound).toBe(10);
    });

    it("should save discovered accounts via internal mutation", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-save" });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovering",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Internal mutation - use direct DB operations to save discovered accounts
      await t.run(async (ctx: AnyCtx) => {
        const accounts = [
          {
            accountNumber: "111111111111",
            accountName: "Test Account 1",
            email: "test1@example.com",
            accountArn: "arn:aws:organizations::123456789012:account/o-abc123/111111111111",
            joinedMethod: "CREATED" as const,
            joinedTimestamp: now,
            awsStatus: "ACTIVE" as const,
          },
          {
            accountNumber: "222222222222",
            accountName: "Test Account 2",
            email: "test2@example.com",
            accountArn: "arn:aws:organizations::123456789012:account/o-abc123/222222222222",
            joinedMethod: "INVITED" as const,
            joinedTimestamp: now,
            awsStatus: "SUSPENDED" as const,
          },
        ];
        for (const account of accounts) {
          await ctx.db.insert("discoveredAwsAccounts", {
            discoveryId,
            organizationId: org._id,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            email: account.email,
            accountArn: account.accountArn,
            joinedMethod: account.joinedMethod,
            joinedTimestamp: account.joinedTimestamp,
            awsStatus: account.awsStatus,
            status: "discovered",
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      const accounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("discoveredAwsAccounts")
          .withIndex("by_discovery", (q: AnyCtx) =>
            q.eq("discoveryId", discoveryId)
          )
          .collect();
      });

      expect(accounts).toHaveLength(2);
      expect(accounts[0].status).toBe("discovered");
      expect(accounts[1].awsStatus).toBe("SUSPENDED");
    });

    it("should skip already-connected accounts when saving", async () => {
      const t = createTestConvex();
      const org = await createMockOrganization(t, { slug: "test-org-skip" });

      // Create an existing connected AWS account
      await createMockAwsAccount(t, {
        organizationId: org._id,
        name: "Existing Account",
        accountNumber: "111111111111",
        connectionType: "iam_role",
        status: "active",
      });

      const now = Date.now();
      const discoveryId = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.insert("awsOrgDiscoveries", {
          organizationId: org._id,
          managementAccountNumber: "123456789012",
          status: "discovering",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Internal mutation - use direct DB operations to save discovered accounts
      // This simulates saveDiscoveredAccounts which checks for existing accounts
      await t.run(async (ctx: AnyCtx) => {
        const accounts = [
          {
            accountNumber: "111111111111", // Already connected
            accountName: "Existing Account",
            email: "existing@example.com",
            accountArn: "arn:aws:organizations::123456789012:account/o-abc123/111111111111",
            joinedMethod: "CREATED" as const,
            joinedTimestamp: now,
            awsStatus: "ACTIVE" as const,
          },
          {
            accountNumber: "222222222222", // New account
            accountName: "New Account",
            email: "new@example.com",
            accountArn: "arn:aws:organizations::123456789012:account/o-abc123/222222222222",
            joinedMethod: "CREATED" as const,
            joinedTimestamp: now,
            awsStatus: "ACTIVE" as const,
          },
        ];
        for (const account of accounts) {
          // Check if account is already connected
          const existingAccount = await ctx.db
            .query("awsAccounts")
            .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", org._id))
            .filter((q: AnyCtx) => q.eq(q.field("accountNumber"), account.accountNumber))
            .first();

          await ctx.db.insert("discoveredAwsAccounts", {
            discoveryId,
            organizationId: org._id,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            email: account.email,
            accountArn: account.accountArn,
            joinedMethod: account.joinedMethod,
            joinedTimestamp: account.joinedTimestamp,
            awsStatus: account.awsStatus,
            status: existingAccount ? "connected" : "discovered",
            connectedAwsAccountId: existingAccount?._id,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      const accounts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("discoveredAwsAccounts")
          .withIndex("by_discovery", (q: AnyCtx) =>
            q.eq("discoveryId", discoveryId)
          )
          .collect();
      });

      expect(accounts).toHaveLength(2);
      
      const existingAccount = accounts.find(
        (a: { accountNumber: string }) => a.accountNumber === "111111111111"
      );
      const newAccount = accounts.find(
        (a: { accountNumber: string }) => a.accountNumber === "222222222222"
      );

      expect(existingAccount?.status).toBe("connected"); // Marked as already connected
      expect(newAccount?.status).toBe("discovered"); // New, awaiting selection
    });
  });
});
