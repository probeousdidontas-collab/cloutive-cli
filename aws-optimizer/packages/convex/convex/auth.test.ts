/**
 * Authentication Tests
 *
 * Tests for the auth helper functions: getAuthUser, safeGetAuthUser,
 * requireAuth, requireWriteAccess, requirePublishAccess.
 *
 * Following TDD: these tests are written BEFORE implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Auth Helper Functions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Test Mode", () => {
    it("should detect test mode when TEST_MODE=true", async () => {
      vi.stubEnv("TEST_MODE", "true");
      const { isTestMode } = await import("./functions");
      expect(isTestMode()).toBe(true);
    });

    it("should not be in test mode when TEST_MODE is unset", async () => {
      vi.stubEnv("TEST_MODE", "false");
      const { isTestMode } = await import("./functions");
      expect(isTestMode()).toBe(false);
    });

    it("should return test user in test mode", async () => {
      vi.stubEnv("TEST_MODE", "true");
      const { getTestModeUser } = await import("./functions");
      const user = getTestModeUser();

      expect(user._id).toBe("test-user-id");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.role).toBe("admin"); // Platform admin role
      expect(user.status).toBe("active");
    });

    it("should allow configurable test user via environment variables", async () => {
      vi.stubEnv("TEST_MODE", "true");
      vi.stubEnv("TEST_USER_EMAIL", "custom@test.com");
      vi.stubEnv("TEST_USER_NAME", "Custom User");
      vi.stubEnv("TEST_USER_ROLE", "user");

      const { getTestModeUser } = await import("./functions");
      const user = getTestModeUser();

      expect(user.email).toBe("custom@test.com");
      expect(user.name).toBe("Custom User");
      expect(user.role).toBe("user");
    });
  });

  describe("requireAuth", () => {
    it("should return user ID in test mode", async () => {
      vi.stubEnv("TEST_MODE", "true");
      const { requireAuth, getTestModeUser } = await import("./functions");

      // Create a mock context
      const mockCtx = {};

      const userId = await requireAuth(mockCtx as Parameters<typeof requireAuth>[0]);
      expect(userId).toBe(getTestModeUser()._id);
    });

    it("should throw when not authenticated (non-test mode)", async () => {
      vi.stubEnv("TEST_MODE", "false");
      const { requireAuth } = await import("./functions");

      // Mock context with getUserIdentity returning null (unauthenticated)
      const mockCtx = {
        auth: {
          getUserIdentity: async () => null,
        },
      };

      // The function should throw Unauthenticated when no user is found
      // Note: In real usage, safeGetAuthUser may throw or return null depending on context
      await expect(
        requireAuth(mockCtx as Parameters<typeof requireAuth>[0])
      ).rejects.toThrow();
    });
  });

  describe("requireWriteAccess", () => {
    it("should allow admin users in test mode", async () => {
      vi.stubEnv("TEST_MODE", "true");
      vi.stubEnv("TEST_USER_ROLE", "admin");

      const { requireWriteAccess } = await import("./functions");
      const mockCtx = {};

      const result = await requireWriteAccess(mockCtx as Parameters<typeof requireWriteAccess>[0]);
      expect(result.authId).toBe("test-user-id");
      expect(result.user.role).toBe("admin");
    });


  });

  describe("requirePublishAccess", () => {
    it("should allow admin users in test mode", async () => {
      vi.stubEnv("TEST_MODE", "true");
      vi.stubEnv("TEST_USER_ROLE", "admin");

      const { requirePublishAccess } = await import("./functions");
      const mockCtx = {};

      const result = await requirePublishAccess(mockCtx as Parameters<typeof requirePublishAccess>[0]);
      expect(result.authId).toBe("test-user-id");
      expect(result.user.role).toBe("admin");
    });

    it("should deny regular users publish access", async () => {
      vi.stubEnv("TEST_MODE", "true");
      vi.stubEnv("TEST_USER_ROLE", "user");

      const { requirePublishAccess } = await import("./functions");
      const mockCtx = {};

      await expect(
        requirePublishAccess(mockCtx as Parameters<typeof requirePublishAccess>[0])
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("Role Helpers", () => {
    it("hasRole should check if user has required role", async () => {
      const { hasRole } = await import("./functions");

      expect(hasRole({ role: "admin" }, ["admin"])).toBe(true);
      expect(hasRole({ role: "user" }, ["admin"])).toBe(false);
      expect(hasRole({ role: "user" }, ["admin", "user"])).toBe(true);
      expect(hasRole(null, ["admin"])).toBe(false);
    });

    it("requireRole should throw if user lacks required role", async () => {
      const { requireRole } = await import("./functions");

      expect(() => requireRole({ role: "admin" }, ["admin"])).not.toThrow();
      expect(() => requireRole({ role: "user" }, ["admin"])).toThrow("Forbidden");
      expect(() => requireRole(null, ["admin"])).toThrow("User not found");
    });
  });
});

describe("Auth Client", () => {
  it("should export authClient", async () => {
    const { authClient } = await import("./auth");
    expect(authClient).toBeDefined();
  });

  it("should export createAuth function", async () => {
    const { createAuth } = await import("./auth");
    expect(createAuth).toBeDefined();
    expect(typeof createAuth).toBe("function");
  });

  it("should export getAuthUser and safeGetAuthUser", async () => {
    const { getAuthUser, safeGetAuthUser } = await import("./auth");
    expect(getAuthUser).toBeDefined();
    expect(safeGetAuthUser).toBeDefined();
  });

  it("should export registerRoutes", async () => {
    const { registerRoutes } = await import("./auth");
    expect(registerRoutes).toBeDefined();
  });
});
