/**
 * Better Auth Configuration for AWS Optimizer
 *
 * Uses @convex-dev/better-auth component for email/password authentication.
 * This file sets up:
 * - Better Auth client for Convex
 * - Auth instance factory for HTTP handlers
 * - User retrieval helpers
 */

import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { admin } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authSchema from "./betterAuth/schema";

// Environment configuration
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "static-schema-generation-placeholder";
const SITE_URL = process.env.SITE_URL || "https://placeholder.convex.site";

/**
 * Better Auth client for Convex.
 * Provides database adapter and user retrieval methods.
 */
export const authClient = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
  }
);

/**
 * Create a Better Auth instance for handling auth API requests.
 * Used by HTTP handlers to process sign-in, sign-up, token refresh, etc.
 */
export const createAuth = (ctx: Parameters<typeof authClient.adapter>[0]) => {
  const isStaticGeneration = Object.keys(ctx).length === 0;
  if (!isStaticGeneration && BETTER_AUTH_SECRET === "static-schema-generation-placeholder") {
    throw new Error("BETTER_AUTH_SECRET environment variable is not set");
  }

  return betterAuth({
    baseURL: SITE_URL,
    secret: BETTER_AUTH_SECRET,
    database: authClient.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedProxy: true,
    plugins: [
      convex() as unknown as BetterAuthPlugin,
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
    ],
    trustedOrigins: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
    ],
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      ipAddress: {
        ipAddressHeaders: [
          "CF-Connecting-IP",
          "x-forwarded-for",
          "x-real-ip",
        ],
        disableIpTracking: false,
      },
    },
  });
};

// Export auth methods from client
export const { getAuthUser, safeGetAuthUser, registerRoutes } = authClient;

// Type for Better Auth user with role
export interface BetterAuthUser {
  _id: string;
  email: string;
  name: string;
  role: string | null;
  emailVerified: boolean;
}
