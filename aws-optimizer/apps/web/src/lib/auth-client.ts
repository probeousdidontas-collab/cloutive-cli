import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { useState } from "react";

// Type definitions for Better Auth organization plugin
type OrganizationRole = "owner" | "admin" | "member" | "viewer";

interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  members?: OrganizationMember[];
}

interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
}

interface OrganizationClientMethods {
  create: (data: { name: string; slug?: string }) => Promise<{ data?: Organization; error?: { message: string } }>;
  setActive: (data: { organizationId: string }) => Promise<{ data?: { organizationId: string }; error?: { message: string } }>;
  inviteMember: (data: { email: string; role: string; organizationId?: string }) => Promise<{ data?: unknown; error?: { message: string } }>;
  acceptInvitation: (data: { invitationId: string }) => Promise<{ data?: { success: boolean }; error?: { message: string } }>;
  list: () => Promise<{ data?: OrganizationWithRole[]; error?: { message: string } }>;
  getFullOrganization: (data: { organizationId?: string }) => Promise<{ data?: Organization; error?: { message: string } }>;
  updateMemberRole: (data: { memberId: string; role: string }) => Promise<{ data?: { success: boolean }; error?: { message: string } }>;
  removeMember: (data: { memberId: string }) => Promise<{ data?: { success: boolean }; error?: { message: string } }>;
  deleteOrganization: (data: { organizationId: string }) => Promise<{ data?: { success: boolean }; error?: { message: string } }>;
  update: (data: { organizationId: string; data: { name?: string; slug?: string; logo?: string; metadata?: Record<string, unknown> } }) => Promise<{ data?: Organization; error?: { message: string } }>;
}

interface ConvexClientMethods {
  token: () => Promise<{ data?: { token: string }; error?: { message: string } }>;
}

// Extended auth client type with organization and convex plugins
interface AuthClientWithPlugins {
  organization: OrganizationClientMethods;
  convex: ConvexClientMethods;
  useSession: () => { data: unknown; isPending: boolean; error: unknown };
  signIn: { email: (data: { email: string; password: string; callbackURL?: string }) => Promise<unknown> };
  signUp: { email: (data: { email: string; password: string; name: string; callbackURL?: string }) => Promise<unknown> };
  signOut: () => Promise<void>;
  getSession: () => Promise<unknown>;
  forgetPassword: (data: { email: string; redirectTo?: string }) => Promise<unknown>;
}

/**
 * Better Auth client for AWS Optimizer frontend.
 *
 * Connects to the Convex backend's Better Auth endpoints.
 * Uses same-origin requests (empty baseURL) to work with the proxy.
 */

const getTestMode = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_TEST_MODE === "true" || import.meta.env.VITE_IS_TEST_MODE === "true") {
      return true;
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_TEST_MODE === "true" || process.env.VITE_IS_TEST_MODE === "true") {
      return true;
    }
  }
  return false;
};

export const IS_TEST_MODE = getTestMode();

/**
 * Get the base URL for Better Auth requests.
 * In development: Use VITE_CONVEX_SITE_URL to point to Convex directly
 * In production: Use empty string for same-origin requests via proxy
 *
 * The production worker proxies /api/auth/* to Convex site.
 */
const getAuthBaseUrl = () => {
  // Check Vite environment variable first (for local dev pointing to Convex directly)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVEX_SITE_URL) {
    return import.meta.env.VITE_CONVEX_SITE_URL;
  }
  // In production, use empty string for same-origin requests via Worker proxy
  // This makes requests go to /api/auth/* which the Worker proxies to Convex
  return "";
};

const AUTH_BASE_URL = getAuthBaseUrl();

export const ACTIVATED_ROLES = ['admin', 'user'] as const;
export type ActivatedRole = typeof ACTIVATED_ROLES[number];

function getTestUser() {
  const email = import.meta.env.VITE_TEST_USER_EMAIL || "test@example.com";
  const name = import.meta.env.VITE_TEST_USER_NAME || "Test User";
  const role = (import.meta.env.VITE_TEST_USER_ROLE || "admin") as "admin" | "user";

  return {
    id: "test-user-id",
    name,
    email,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role,
  };
}

const TEST_USER = IS_TEST_MODE ? getTestUser() : null;

const TEST_SESSION = TEST_USER ? {
  user: TEST_USER,
  session: {
    id: "test-session-id",
    userId: "test-user-id",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
} : null;

/**
 * Auth client instance for Better Auth.
 * Provides methods for sign-in, sign-up, password reset, and session management.
 * Includes convexClient plugin for Convex token integration.
 * Includes organizationClient plugin for multi-tenancy support.
 */
const baseAuthClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  fetchOptions: {
    credentials: "include", // Send cookies with auth requests
  },
  // Cast plugins to any to avoid Better Auth type compatibility issues
  // The plugins work correctly at runtime; this is a TypeScript limitation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [
    convexClient(),
    adminClient(),
    organizationClient({
      // Enable dynamic access control on client
      // Note: Permission checks are always verified server-side
    }),
  ] as any[],
});

// Cast to extended type to access plugin methods with proper typing
export const authClient = baseAuthClient as typeof baseAuthClient & AuthClientWithPlugins;

/**
 * Custom useSession hook with test mode support.
 * In test mode, returns a mock session without hitting the backend.
 */
export function useSession() {
  const [testState] = useState(() => ({
    data: IS_TEST_MODE ? TEST_SESSION : null,
    isPending: false,
    error: null,
  }));

  const realSession = authClient.useSession();

  if (IS_TEST_MODE) {
    return testState;
  }

  return realSession;
}

// Export hooks and methods from auth client
export const { signIn, signUp, signOut, getSession } = authClient;

// Note: Organization methods are available via authClient.organization
// We export helper methods below for convenience with test mode support

/**
 * Organization helper methods for convenience.
 * These wrap the authClient.organization methods with better typing.
 */
export const organizationMethods = {
  /**
   * Create a new organization.
   */
  create: (name: string, slug?: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { id: "test-org-id", name, slug }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.create({ name, slug });
  },

  /**
   * Set the active organization for the current session.
   */
  setActive: (organizationId: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { organizationId }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.setActive({ organizationId });
  },

  /**
   * Invite a member to an organization.
   */
  inviteMember: (email: string, role: string, organizationId?: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { email, role }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.inviteMember({ email, role, organizationId });
  },

  /**
   * Accept an invitation to join an organization.
   */
  acceptInvitation: (invitationId: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { success: true }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.acceptInvitation({ invitationId });
  },

  /**
   * List all organizations the current user belongs to.
   */
  list: () => {
    if (IS_TEST_MODE) {
      return Promise.resolve({
        data: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" as const }],
        error: null,
      });
    }
    return (authClient as AuthClientWithPlugins).organization.list();
  },

  /**
   * Get the full organization details.
   */
  getFullOrganization: (organizationId?: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({
        data: {
          id: "test-org-id",
          name: "Test Organization",
          slug: "test-org",
          members: [{ id: "test-user-id", name: "Test User", email: "test@example.com", role: "owner" as const }],
        },
        error: null,
      });
    }
    return (authClient as AuthClientWithPlugins).organization.getFullOrganization({ organizationId });
  },

  /**
   * Update member role in an organization.
   */
  updateMemberRole: (memberId: string, role: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { success: true }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.updateMemberRole({ memberId, role });
  },

  /**
   * Remove a member from an organization.
   */
  removeMember: (memberId: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { success: true }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.removeMember({ memberId });
  },

  /**
   * Delete an organization (owner only).
   */
  delete: (organizationId: string) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({ data: { success: true }, error: null });
    }
    return (authClient as AuthClientWithPlugins).organization.deleteOrganization({ organizationId });
  },

  /**
   * Update an organization's name, slug, logo, or metadata.
   * Settings are stored in the metadata field.
   */
  update: (data: {
    organizationId: string;
    name?: string;
    slug?: string;
    logo?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (IS_TEST_MODE) {
      return Promise.resolve({
        data: {
          id: data.organizationId,
          name: data.name || "Test Organization",
          slug: data.slug || "test-org",
          metadata: data.metadata || {},
        },
        error: null,
      });
    }
    return (authClient as AuthClientWithPlugins).organization.update({
      organizationId: data.organizationId,
      data: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        metadata: data.metadata,
      },
    });
  },

  /**
   * Get the active organization from the current session.
   * Returns the organization with its metadata (settings).
   */
  getActive: () => {
    if (IS_TEST_MODE) {
      return Promise.resolve({
        data: {
          id: "test-org-id",
          name: "Test Organization",
          slug: "test-org",
          logo: null,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          metadata: {
            plan: "professional",
            defaultRegion: "us-east-1",
            enableNotifications: true,
            notificationPreferences: {
              emailFrequency: "daily",
              alertTypes: ["budget_exceeded", "anomaly_detected", "recommendation_available"],
            },
          },
        },
        error: null,
      });
    }
    return (authClient as AuthClientWithPlugins).organization.getFullOrganization({});
  },
};

/**
 * Sign in with email and password.
 * @param email - User's email address
 * @param password - User's password
 * @param callbackURL - URL to redirect to after successful login (default: /chat)
 */
export const signInWithEmail = (
  email: string,
  password: string,
  callbackURL: string = "/chat"
) => {
  if (IS_TEST_MODE) {
    window.location.href = callbackURL;
    return Promise.resolve({ error: null });
  }
  return authClient.signIn.email({
    email,
    password,
    callbackURL,
  });
};

/**
 * Sign up with email, password, and name.
 * @param email - User's email address
 * @param password - User's password
 * @param name - User's full name
 * @param callbackURL - URL to redirect to after successful signup (default: /chat)
 */
export const signUpWithEmail = (
  email: string,
  password: string,
  name: string,
  callbackURL: string = "/chat"
) => {
  if (IS_TEST_MODE) {
    window.location.href = callbackURL;
    return Promise.resolve({ error: null });
  }
  return authClient.signUp.email({
    email,
    password,
    name,
    callbackURL,
  });
};

/**
 * Request password reset email.
 * @param email - User's email address
 * @param redirectTo - URL to include in the reset email (default: /login)
 */
export const forgotPassword = (email: string, redirectTo: string = "/login") => {
  return authClient.forgetPassword({
    email,
    redirectTo,
  });
};
