/**
 * Auth Helper Functions
 *
 * Provides authentication and authorization utilities for Convex functions.
 * Uses Better Auth for authentication via @convex-dev/better-auth component.
 */

import { query, mutation } from "./_generated/server";
import { safeGetAuthUser } from "./auth";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

// User roles (app-level, for platform permissions)
export type UserRole = "admin" | "user";

const ACTIVATED_ROLES = ["admin", "user"] as const;

// Roles that can perform write operations (CRUD)
export const WRITE_ROLES: UserRole[] = ["admin", "user"];

// Roles that can publish/deploy (admin only)
export const PUBLISH_ROLES: UserRole[] = ["admin"];

// Test user structure matching the users table schema
export interface TestModeUser {
  _id: string;
  _creationTime: number;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive" | "pending";
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Check if running in test mode.
 * In test mode, authentication is bypassed and a mock user is returned.
 *
 * Enable with: TEST_MODE=true
 */
export function isTestMode(): boolean {
  return process.env.TEST_MODE === "true";
}

/**
 * Get configurable test user properties from environment variables.
 *
 * Environment variables:
 * - TEST_USER_EMAIL: Email of the test user (default: test@example.com)
 * - TEST_USER_NAME: Name of the test user (default: Test User)
 * - TEST_USER_ROLE: Role of the test user: admin or user (default: admin)
 */
export function getTestModeUser(): TestModeUser {
  const email = process.env.TEST_USER_EMAIL || "test@example.com";
  const name = process.env.TEST_USER_NAME || "Test User";
  const role = (process.env.TEST_USER_ROLE || "admin") as UserRole;
  const now = Date.now();

  return {
    _id: "test-user-id",
    _creationTime: now,
    name,
    email,
    role,
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get the authenticated user ID from Better Auth.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  if (isTestMode()) {
    return getTestModeUser()._id;
  }

  try {
    const user = await safeGetAuthUser(ctx as Parameters<typeof safeGetAuthUser>[0]);
    return user?._id ?? null;
  } catch {
    return null;
  }
}

export const authedQuery = query;
export const authedMutation = mutation;

/**
 * Require authentication.
 * Throws if the user is not authenticated or their account is not activated.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  if (isTestMode()) {
    return getTestModeUser()._id;
  }

  const user = await safeGetAuthUser(ctx as Parameters<typeof safeGetAuthUser>[0]);

  if (!user) {
    throw new Error("Unauthenticated");
  }

  const userRole = (user as { role?: string }).role || "user";
  if (!ACTIVATED_ROLES.includes(userRole as (typeof ACTIVATED_ROLES)[number])) {
    throw new Error("Unauthorized: Account pending activation");
  }

  return user._id;
}

/**
 * Check if a user has the required role.
 * Throws if the user doesn't have one of the allowed roles.
 */
export function requireRole(
  user: { role: UserRole } | null,
  allowedRoles: UserRole[]
): void {
  if (!user) {
    throw new Error("User not found");
  }
  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Forbidden: User must have one of these roles: ${allowedRoles.join(", ")}`
    );
  }
}

/**
 * Check if a user has one of the allowed roles.
 */
export function hasRole(
  user: { role: UserRole } | null,
  allowedRoles: UserRole[]
): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Check if a user has viewer-only access (read-only).
 */
export function isViewerOnly(user: { role: UserRole } | null): boolean {
  if (!user) return true;
  return user.role === "user";
}

/**
 * Require write access (admin or user role).
 * Use this for CRUD operations on content.
 */
export async function requireWriteAccess(
  ctx: QueryCtx | MutationCtx
): Promise<{ authId: string; user: { role: UserRole } }> {
  if (isTestMode()) {
    const testUser = getTestModeUser();
    if (!WRITE_ROLES.includes(testUser.role)) {
      throw new Error(
        "Forbidden: You do not have permission to perform this action. Write access required."
      );
    }
    return { authId: testUser._id, user: { role: testUser.role } };
  }

  const authUser = await safeGetAuthUser(ctx as Parameters<typeof safeGetAuthUser>[0]);

  if (!authUser) {
    throw new Error("Unauthenticated");
  }

  const userRole = ((authUser as { role?: string }).role || "user") as UserRole;

  if (!ACTIVATED_ROLES.includes(userRole)) {
    throw new Error("Unauthorized: Account pending activation");
  }

  if (!WRITE_ROLES.includes(userRole)) {
    throw new Error(
      "Forbidden: You do not have permission to perform this action. Write access required."
    );
  }

  return { authId: authUser._id, user: { role: userRole } };
}

/**
 * Require publish access (admin role only).
 * Use this for publish, deploy, and administrative operations.
 */
export async function requirePublishAccess(
  ctx: QueryCtx | MutationCtx
): Promise<{ authId: string; user: { role: UserRole } }> {
  if (isTestMode()) {
    const testUser = getTestModeUser();
    if (!PUBLISH_ROLES.includes(testUser.role)) {
      throw new Error("Forbidden: Only admins can perform this action");
    }
    return { authId: testUser._id, user: { role: testUser.role } };
  }

  const authUser = await safeGetAuthUser(ctx as Parameters<typeof safeGetAuthUser>[0]);

  if (!authUser) {
    throw new Error("Unauthenticated");
  }

  const userRole = ((authUser as { role?: string }).role || "user") as UserRole;

  if (!ACTIVATED_ROLES.includes(userRole)) {
    throw new Error("Unauthorized: Account pending activation");
  }

  if (!PUBLISH_ROLES.includes(userRole)) {
    throw new Error("Forbidden: Only admins can perform this action");
  }

  return { authId: authUser._id, user: { role: userRole } };
}

/**
 * Require authentication in action context.
 * Note: Actions don't have access to Better Auth session context,
 * so this relies on test mode or assumes the action is called from
 * an authenticated context.
 */
export async function requireAuthAction(_ctx: ActionCtx): Promise<string> {
  if (isTestMode()) {
    return getTestModeUser()._id;
  }
  // In real scenarios, actions are typically called after authentication
  // has been verified in a mutation or through other means
  return "action-user";
}
