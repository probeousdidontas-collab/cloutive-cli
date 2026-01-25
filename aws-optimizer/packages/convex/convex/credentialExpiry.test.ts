/**
 * Credential Expiry Monitoring Tests
 *
 * Tests for the credential expiry check cron job functionality.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex, type TestCtx } from "../test.setup";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Type assertion helper for convex-test
type AnyCtx = TestCtx;

describe("Credential Expiry Monitoring", () => {
  async function setupTestData(t: ReturnType<typeof createTestConvex>) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Create organization
    const orgId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        plan: "free",
        settings: {},
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create AWS account with expiring credentials
    const expiringAccountId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsAccounts", {
        organizationId: orgId,
        name: "Expiring Account",
        accountNumber: "123456789012",
        connectionType: "credentials_file",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create credentials expiring in 3 days
    const expiringCredId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsCredentials", {
        awsAccountId: expiringAccountId,
        encryptedAccessKeyId: "encrypted-AKIAIOSFODNN7EXAMPLE",
        encryptedSecretAccessKey: "encrypted-secret",
        expiresAt: now + 3 * oneDayMs, // 3 days from now
        validationStatus: "healthy",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create AWS account with expired credentials
    const expiredAccountId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsAccounts", {
        organizationId: orgId,
        name: "Expired Account",
        accountNumber: "123456789013",
        connectionType: "credentials_file",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create already expired credentials
    const expiredCredId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsCredentials", {
        awsAccountId: expiredAccountId,
        encryptedAccessKeyId: "encrypted-AKIAI44QH8DHBEXAMPLE",
        encryptedSecretAccessKey: "encrypted-secret2",
        expiresAt: now - oneDayMs, // Expired 1 day ago
        validationStatus: "healthy",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create AWS account with healthy credentials (not expiring)
    const healthyAccountId = await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsAccounts", {
        organizationId: orgId,
        name: "Healthy Account",
        accountNumber: "123456789014",
        connectionType: "access_key",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create credentials without expiry (permanent keys)
    await t.run(async (ctx: AnyCtx) => {
      return await ctx.db.insert("awsCredentials", {
        awsAccountId: healthyAccountId,
        encryptedAccessKeyId: "encrypted-AKIAZZZZZZZZZEXAMPLE",
        encryptedSecretAccessKey: "encrypted-secret3",
        // No expiresAt - permanent credentials
        validationStatus: "healthy",
        createdAt: now,
        updatedAt: now,
      });
    });

    return {
      orgId,
      expiringAccountId,
      expiringCredId,
      expiredAccountId,
      expiredCredId,
      healthyAccountId,
    };
  }

  describe("getExpiringCredentials query", () => {
    it("should return credentials expiring within 7 days", async () => {
      const t = createTestConvex();
      const { expiringAccountId } = await setupTestData(t);

      const result = await t.query(api.crons.getExpiringCredentials, {});

      // Should include the expiring account (3 days) and expired account
      expect(result.length).toBeGreaterThanOrEqual(1);

      const expiringCred = result.find((c) => c.awsAccountId === expiringAccountId);
      expect(expiringCred).toBeDefined();
      expect(expiringCred?.daysUntilExpiry).toBe(3);
    });

    it("should return expired credentials with negative daysUntilExpiry", async () => {
      const t = createTestConvex();
      const { expiredAccountId } = await setupTestData(t);

      const result = await t.query(api.crons.getExpiringCredentials, {});

      const expiredCred = result.find((c) => c.awsAccountId === expiredAccountId);
      expect(expiredCred).toBeDefined();
      expect(expiredCred?.daysUntilExpiry).toBeLessThan(0);
    });

    it("should not return healthy credentials without expiry", async () => {
      const t = createTestConvex();
      const { healthyAccountId } = await setupTestData(t);

      const result = await t.query(api.crons.getExpiringCredentials, {});

      const healthyCred = result.find((c) => c.awsAccountId === healthyAccountId);
      expect(healthyCred).toBeUndefined();
    });

    it("should sort by urgency (most urgent first)", async () => {
      const t = createTestConvex();
      await setupTestData(t);

      const result = await t.query(api.crons.getExpiringCredentials, {});

      // Verify sorted by daysUntilExpiry ascending
      for (let i = 1; i < result.length; i++) {
        expect(result[i].daysUntilExpiry).toBeGreaterThanOrEqual(result[i - 1].daysUntilExpiry);
      }
    });
  });

  describe("createCredentialExpiryAlert mutation", () => {
    it("should create alert for expiring credentials", async () => {
      const t = createTestConvex();
      const { orgId, expiringAccountId } = await setupTestData(t);

      const result = await t.mutation(api.crons.createCredentialExpiryAlert, {
        organizationId: orgId,
        awsAccountId: expiringAccountId,
        accountName: "Expiring Account",
        daysUntilExpiry: 3,
        isExpired: false,
      });

      expect(result.created).toBe(true);

      // Verify alert was created
      const alerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", orgId))
          .collect();
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0].title).toContain("Expiring Soon");
      expect(alerts[0].severity).toBe("warning");
    });

    it("should create critical alert for expired credentials", async () => {
      const t = createTestConvex();
      const { orgId, expiredAccountId } = await setupTestData(t);

      const result = await t.mutation(api.crons.createCredentialExpiryAlert, {
        organizationId: orgId,
        awsAccountId: expiredAccountId,
        accountName: "Expired Account",
        daysUntilExpiry: -1,
        isExpired: true,
      });

      expect(result.created).toBe(true);

      const alerts = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", orgId))
          .collect();
      });

      expect(alerts[0].title).toContain("Expired");
      expect(alerts[0].severity).toBe("critical");
    });

    it("should not create duplicate alerts", async () => {
      const t = createTestConvex();
      const { orgId, expiringAccountId } = await setupTestData(t);

      // Create first alert
      await t.mutation(api.crons.createCredentialExpiryAlert, {
        organizationId: orgId,
        awsAccountId: expiringAccountId,
        accountName: "Expiring Account",
        daysUntilExpiry: 3,
        isExpired: false,
      });

      // Try to create duplicate
      const result = await t.mutation(api.crons.createCredentialExpiryAlert, {
        organizationId: orgId,
        awsAccountId: expiringAccountId,
        accountName: "Expiring Account",
        daysUntilExpiry: 2,
        isExpired: false,
      });

      expect(result.created).toBe(false);
      expect(result.reason).toContain("already exists");
    });
  });

  describe("updateCredentialExpiryStatus mutation", () => {
    it("should update credential validation status", async () => {
      const t = createTestConvex();
      const { expiringCredId } = await setupTestData(t);

      await t.mutation(api.crons.updateCredentialExpiryStatus, {
        credentialId: expiringCredId,
        validationStatus: "expiring",
      });

      const credential = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(expiringCredId);
      });

      expect(credential?.validationStatus).toBe("expiring");
    });
  });
});
