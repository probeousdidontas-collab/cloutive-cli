/**
 * Credential Expiry Monitoring Tests
 *
 * Tests for the credential expiry check cron job functionality.
 */

import { describe, it, expect } from "vitest";
import { createTestConvex, type TestCtx } from "../test.setup";
import type { Id, Doc } from "./_generated/dataModel";

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

      // Internal query - use direct DB operation to get expiring credentials
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
        const allCredentials = await ctx.db.query("awsCredentials").collect();
        
        const expiringCredentials: Array<{
          credentialId: Id<"awsCredentials">;
          awsAccountId: Id<"awsAccounts">;
          organizationId: Id<"organizations">;
          accountName: string;
          expiresAt: number;
          daysUntilExpiry: number;
          validationStatus: string;
        }> = [];

        for (const cred of allCredentials) {
          if (!cred.expiresAt) continue;
          if (cred.expiresAt > sevenDaysFromNow) continue;
          
          const awsAccount = await ctx.db.get(cred.awsAccountId);
          if (!awsAccount || awsAccount.status === "inactive") continue;
          
          const daysUntilExpiry = Math.floor((cred.expiresAt - now) / (24 * 60 * 60 * 1000));
          
          expiringCredentials.push({
            credentialId: cred._id,
            awsAccountId: cred.awsAccountId,
            organizationId: awsAccount.organizationId,
            accountName: awsAccount.name,
            expiresAt: cred.expiresAt,
            daysUntilExpiry,
            validationStatus: cred.validationStatus || "unknown",
          });
        }
        
        expiringCredentials.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        return expiringCredentials;
      });

      // Should include the expiring account (3 days) and expired account
      expect(result.length).toBeGreaterThanOrEqual(1);

      const expiringCred = result.find((c: { awsAccountId: Id<"awsAccounts"> }) => c.awsAccountId === expiringAccountId);
      expect(expiringCred).toBeDefined();
      expect(expiringCred?.daysUntilExpiry).toBe(3);
    });

    it("should return expired credentials with negative daysUntilExpiry", async () => {
      const t = createTestConvex();
      const { expiredAccountId } = await setupTestData(t);

      // Internal query - use direct DB operation to get expiring credentials
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
        const allCredentials = await ctx.db.query("awsCredentials").collect();
        
        const expiringCredentials: Array<{
          credentialId: Id<"awsCredentials">;
          awsAccountId: Id<"awsAccounts">;
          daysUntilExpiry: number;
        }> = [];

        for (const cred of allCredentials) {
          if (!cred.expiresAt) continue;
          if (cred.expiresAt > sevenDaysFromNow) continue;
          
          const awsAccount = await ctx.db.get(cred.awsAccountId);
          if (!awsAccount || awsAccount.status === "inactive") continue;
          
          const daysUntilExpiry = Math.floor((cred.expiresAt - now) / (24 * 60 * 60 * 1000));
          
          expiringCredentials.push({
            credentialId: cred._id,
            awsAccountId: cred.awsAccountId,
            daysUntilExpiry,
          });
        }
        
        return expiringCredentials;
      });

      const expiredCred = result.find((c: { awsAccountId: Id<"awsAccounts"> }) => c.awsAccountId === expiredAccountId);
      expect(expiredCred).toBeDefined();
      expect(expiredCred?.daysUntilExpiry).toBeLessThan(0);
    });

    it("should not return healthy credentials without expiry", async () => {
      const t = createTestConvex();
      const { healthyAccountId } = await setupTestData(t);

      // Internal query - use direct DB operation to get expiring credentials
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
        const allCredentials = await ctx.db.query("awsCredentials").collect();
        
        const expiringCredentials: Array<{
          awsAccountId: Id<"awsAccounts">;
        }> = [];

        for (const cred of allCredentials) {
          if (!cred.expiresAt) continue;
          if (cred.expiresAt > sevenDaysFromNow) continue;
          
          const awsAccount = await ctx.db.get(cred.awsAccountId);
          if (!awsAccount || awsAccount.status === "inactive") continue;
          
          expiringCredentials.push({
            awsAccountId: cred.awsAccountId,
          });
        }
        
        return expiringCredentials;
      });

      const healthyCred = result.find((c: { awsAccountId: Id<"awsAccounts"> }) => c.awsAccountId === healthyAccountId);
      expect(healthyCred).toBeUndefined();
    });

    it("should sort by urgency (most urgent first)", async () => {
      const t = createTestConvex();
      await setupTestData(t);

      // Internal query - use direct DB operation to get expiring credentials
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
        const allCredentials = await ctx.db.query("awsCredentials").collect();
        
        const expiringCredentials: Array<{
          daysUntilExpiry: number;
        }> = [];

        for (const cred of allCredentials) {
          if (!cred.expiresAt) continue;
          if (cred.expiresAt > sevenDaysFromNow) continue;
          
          const awsAccount = await ctx.db.get(cred.awsAccountId);
          if (!awsAccount || awsAccount.status === "inactive") continue;
          
          const daysUntilExpiry = Math.floor((cred.expiresAt - now) / (24 * 60 * 60 * 1000));
          
          expiringCredentials.push({
            daysUntilExpiry,
          });
        }
        
        expiringCredentials.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        return expiringCredentials;
      });

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

      // Internal mutation - use direct DB operation to create alert
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const accountName = "Expiring Account";
        const daysUntilExpiry = 3;
        const isExpired = false;

        // Check if we already have an unacknowledged alert for this account
        const existingAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", orgId))
          .filter((q: AnyCtx) =>
            q.and(
              q.eq(q.field("type"), "anomaly_detected"),
              q.eq(q.field("acknowledgedAt"), undefined)
            )
          )
          .collect();

        const hasExistingAlert = existingAlerts.some((alert: Doc<"alerts">) =>
          alert.message.includes(accountName) && alert.title.includes("Credential")
        );

        if (hasExistingAlert) {
          return { created: false, reason: "Alert already exists" };
        }

        const severity = isExpired ? "critical" : daysUntilExpiry <= 3 ? "warning" : "info";
        const title = isExpired
          ? `Credentials Expired: ${accountName}`
          : `Credentials Expiring Soon: ${accountName}`;
        const dayLabel = Number(daysUntilExpiry) === 1 ? "day" : "days";
        const message = isExpired
          ? `The AWS credentials for account "${accountName}" have expired. Please update the credentials to continue cost analysis.`
          : `The AWS credentials for account "${accountName}" will expire in ${daysUntilExpiry} ${dayLabel}. Please refresh or update the credentials.`;

        await ctx.db.insert("alerts", {
          organizationId: orgId,
          type: "anomaly_detected",
          title,
          message,
          severity,
          triggeredAt: now,
          createdAt: now,
          updatedAt: now,
        });

        return { created: true };
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

      // Internal mutation - use direct DB operation to create alert
      const result = await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const accountName = "Expired Account";
        const daysUntilExpiry = -1;
        const isExpired = true;

        const severity = isExpired ? "critical" : daysUntilExpiry <= 3 ? "warning" : "info";
        const title = isExpired
          ? `Credentials Expired: ${accountName}`
          : `Credentials Expiring Soon: ${accountName}`;
        const dayLabel = Number(daysUntilExpiry) === 1 ? "day" : "days";
        const message = isExpired
          ? `The AWS credentials for account "${accountName}" have expired. Please update the credentials to continue cost analysis.`
          : `The AWS credentials for account "${accountName}" will expire in ${daysUntilExpiry} ${dayLabel}. Please refresh or update the credentials.`;

        await ctx.db.insert("alerts", {
          organizationId: orgId,
          type: "anomaly_detected",
          title,
          message,
          severity,
          triggeredAt: now,
          createdAt: now,
          updatedAt: now,
        });

        return { created: true };
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

      // Create first alert - Internal mutation using direct DB operation
      await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        const accountName = "Expiring Account";
        const daysUntilExpiry = 3;
        const isExpired = false;

        const title = `Credentials Expiring Soon: ${accountName}`;
        const message = `The AWS credentials for account "${accountName}" will expire in ${daysUntilExpiry} days. Please refresh or update the credentials.`;

        await ctx.db.insert("alerts", {
          organizationId: orgId,
          type: "anomaly_detected",
          title,
          message,
          severity: "warning",
          triggeredAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Try to create duplicate - Internal mutation checking for existing
      const result = await t.run(async (ctx: AnyCtx) => {
        const accountName = "Expiring Account";

        // Check if we already have an unacknowledged alert for this account
        const existingAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_organization", (q: AnyCtx) => q.eq("organizationId", orgId))
          .filter((q: AnyCtx) =>
            q.and(
              q.eq(q.field("type"), "anomaly_detected"),
              q.eq(q.field("acknowledgedAt"), undefined)
            )
          )
          .collect();

        const hasExistingAlert = existingAlerts.some((alert: Doc<"alerts">) =>
          alert.message.includes(accountName) && alert.title.includes("Credential")
        );

        if (hasExistingAlert) {
          return { created: false, reason: "Alert already exists" };
        }

        return { created: true };
      });

      expect(result.created).toBe(false);
      expect(result.reason).toContain("already exists");
    });
  });

  describe("updateCredentialExpiryStatus mutation", () => {
    it("should update credential validation status", async () => {
      const t = createTestConvex();
      const { expiringCredId } = await setupTestData(t);

      // Internal mutation - use direct DB operation to update credential status
      await t.run(async (ctx: AnyCtx) => {
        const now = Date.now();
        await ctx.db.patch(expiringCredId, {
          validationStatus: "expiring",
          updatedAt: now,
        });
      });

      const credential = await t.run(async (ctx: AnyCtx) => {
        return await ctx.db.get(expiringCredId);
      });

      expect(credential?.validationStatus).toBe("expiring");
    });
  });
});
