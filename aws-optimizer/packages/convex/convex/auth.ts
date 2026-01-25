/**
 * Better Auth Configuration for AWS Optimizer
 *
 * Uses @convex-dev/better-auth component for email/password authentication.
 * This file sets up:
 * - Better Auth client for Convex
 * - Auth instance factory for HTTP handlers
 * - User retrieval helpers
 * - Organization plugin for multi-tenancy
 */

import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authSchema from "./betterAuth/schema";

// Environment configuration
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "static-schema-generation-placeholder";
const SITE_URL = process.env.SITE_URL || "https://placeholder.convex.site";
// Note: Resend email sending is handled via organizationEmails.ts actions
// The sendInvitationEmail callback below logs the invitation for manual handling
// or can be extended to call an HTTP endpoint that triggers the email action

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
      organization({
        // Allow users to create organizations
        allowUserToCreateOrganization: true,
        // Default role for organization creator
        creatorRole: "owner",
        // Maximum members per organization (can be overridden per-plan)
        membershipLimit: 100,
        // Invitation expiration in seconds (7 days)
        invitationExpiresIn: 7 * 24 * 60 * 60,
        // Send invitation email using Resend
        // Note: This callback runs in the Better Auth context, not Convex action context
        // We log the invitation and the actual email is sent via the frontend or a webhook
        sendInvitationEmail: async (data) => {
          const invitationLink = `${SITE_URL}/accept-invitation/${data.id}`;
          
          // Log invitation details for debugging
          // Cast inviter to access properties that may not be in the type
          const inviter = data.inviter as { name?: string; email?: string; id?: string };
          console.log(`[Organization Invite] New invitation created:`);
          console.log(`  - To: ${data.email}`);
          console.log(`  - Organization: ${data.organization.name}`);
          console.log(`  - Role: ${data.role}`);
          console.log(`  - Invited by: ${inviter.name || inviter.email || inviter.id || "unknown"}`);
          console.log(`  - Link: ${invitationLink}`);
          
          // In production, you can:
          // 1. Call an HTTP endpoint to trigger email sending
          // 2. Use a webhook to listen for invitation events
          // 3. Poll for pending invitations and send emails via a cron job
          // For now, the invitation link is logged and can be shared manually
        },
      }) as unknown as BetterAuthPlugin,
    ],
    trustedOrigins: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
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
