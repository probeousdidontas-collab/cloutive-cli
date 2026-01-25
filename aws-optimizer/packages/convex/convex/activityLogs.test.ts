/**
 * Activity Logs Tests
 *
 * Tests for US-045: Implement activity logging
 * Following TDD: tests written BEFORE implementation.
 *
 * Acceptance Criteria:
 * 1. Create activityLogs table with user, action, entity, timestamp (already in schema)
 * 2. Log all mutations (create, update, delete) automatically
 * 3. Create /settings/activity route to view logs
 * 4. Filter by user, action type, and date range
 * 5. Retain logs for 90 days
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestConvex } from "../test.setup";
import { api } from "./_generated/api";
import {
  createMockUser,
  createMockOrganization,
  createMockOrgMember,
  createMockActivityLog,
} from "./test.helpers";

// Type assertion helper for convex-test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

describe("Activity Logs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TEST_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("list query", () => {
    it("should list activity logs for an organization", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      // Create some activity logs
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
        entityType: "aws_account",
        entityId: "test-account-1",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "update",
        entityType: "organization",
        entityId: org._id,
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
      });

      expect(result.logs.length).toBe(2);
    });

    it("should filter by action type", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
        entityType: "aws_account",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "update",
        entityType: "aws_account",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "delete",
        entityType: "aws_account",
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].action).toBe("create");
    });

    it("should filter by user", async () => {
      const t = createTestConvex();

      const user1 = await createMockUser(t, { email: "user1@example.com" });
      const user2 = await createMockUser(t, { email: "user2@example.com" });
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user1._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user2._id,
        role: "member",
      });

      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user1._id,
        action: "create",
        entityType: "aws_account",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user2._id,
        action: "create",
        entityType: "budget",
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user1._id,
        filterUserId: user2._id,
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].userId).toBe(user2._id);
    });

    it("should filter by date range", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      // Create logs with different timestamps by inserting directly
      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "old-1",
          createdAt: now - 10 * oneDay, // 10 days ago
        });
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "recent-1",
          createdAt: now - 2 * oneDay, // 2 days ago
        });
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "today-1",
          createdAt: now, // today
        });
      });

      // Filter to last 5 days
      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
        startDate: now - 5 * oneDay,
        endDate: now + oneDay,
      });

      expect(result.logs.length).toBe(2);
    });

    it("should filter by entity type", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
        entityType: "aws_account",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
        entityType: "budget",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "update",
        entityType: "organization",
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
        entityType: "aws_account",
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].entityType).toBe("aws_account");
    });

    it("should reject access from non-members", async () => {
      const t = createTestConvex();

      const owner = await createMockUser(t, { email: "owner@example.com" });
      const nonMember = await createMockUser(t, { email: "nonmember@example.com" });
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: owner._id,
        role: "owner",
      });

      await expect(
        t.query(api.activityLogs.list, {
          organizationId: org._id,
          userId: nonMember._id,
        })
      ).rejects.toThrow();
    });

    it("should return logs ordered by timestamp descending", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const now = Date.now();

      await t.run(async (ctx: AnyCtx) => {
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "first",
          createdAt: now - 1000,
        });
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "update",
          entityType: "aws_account",
          entityId: "second",
          createdAt: now,
        });
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
      });

      expect(result.logs.length).toBe(2);
      expect(result.logs[0].entityId).toBe("second"); // Most recent first
      expect(result.logs[1].entityId).toBe("first");
    });

    it("should support pagination with limit", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      // Create 5 logs
      for (let i = 0; i < 5; i++) {
        await createMockActivityLog(t, {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: `account-${i}`,
        });
      }

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
        limit: 3,
      });

      expect(result.logs.length).toBe(3);
    });

    it("should include user information with logs", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t, {
        email: "test@example.com",
        name: "Test User",
      });
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user._id,
        action: "create",
        entityType: "aws_account",
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].user).toBeDefined();
      expect(result.logs[0].user?.name).toBe("Test User");
      expect(result.logs[0].user?.email).toBe("test@example.com");
    });
  });

  describe("getUsers query", () => {
    it("should return unique users who have activity in the organization", async () => {
      const t = createTestConvex();

      const user1 = await createMockUser(t, { email: "user1@example.com", name: "User One" });
      const user2 = await createMockUser(t, { email: "user2@example.com", name: "User Two" });
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user1._id,
        role: "owner",
      });
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user2._id,
        role: "member",
      });

      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user1._id,
        action: "create",
        entityType: "aws_account",
      });
      await createMockActivityLog(t, {
        organizationId: org._id,
        userId: user2._id,
        action: "update",
        entityType: "budget",
      });

      const result = await t.query(api.activityLogs.getUsers, {
        organizationId: org._id,
        userId: user1._id,
      });

      expect(result.length).toBe(2);
      expect(result.map((u: { name: string }) => u.name)).toContain("User One");
      expect(result.map((u: { name: string }) => u.name)).toContain("User Two");
    });
  });

  describe("90-day retention", () => {
    it("should only return logs from the last 90 days by default", async () => {
      const t = createTestConvex();

      const user = await createMockUser(t);
      const org = await createMockOrganization(t);
      await createMockOrgMember(t, {
        organizationId: org._id,
        userId: user._id,
        role: "owner",
      });

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      await t.run(async (ctx: AnyCtx) => {
        // Log from 100 days ago (should be excluded)
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "old-account",
          createdAt: now - 100 * oneDay,
        });
        // Log from 30 days ago (should be included)
        await ctx.db.insert("activityLogs", {
          organizationId: org._id,
          userId: user._id,
          action: "create",
          entityType: "aws_account",
          entityId: "recent-account",
          createdAt: now - 30 * oneDay,
        });
      });

      const result = await t.query(api.activityLogs.list, {
        organizationId: org._id,
        userId: user._id,
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].entityId).toBe("recent-account");
    });
  });
});
