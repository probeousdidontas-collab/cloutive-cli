import { ConvexProviderWithAuth, ConvexProvider, ConvexReactClient } from "convex/react";
import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { authClient, IS_TEST_MODE } from "./auth-client";

// Type for the Convex plugin methods
interface ConvexPluginMethods {
  token: () => Promise<{ data?: { token: string }; error?: { message: string } }>;
}

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

// eslint-disable-next-line react-refresh/only-export-components
function getConvexClientUrl(): string | null {
  if (!convexUrl) return null;

  // Use proxy in production (when served from Cloudflare Worker)
  if (import.meta.env.PROD) {
    // Use relative URL to proxy through the same origin at /convex
    return `${window.location.origin}/convex`;
  }

  // In development, connect directly to Convex
  return convexUrl;
}

const convex = (() => {
  const url = getConvexClientUrl();
  return url ? new ConvexReactClient(url) : null;
})();

/**
 * Check if running in test mode on the frontend.
 * In test mode, authentication can be bypassed.
 *
 * Enable with: VITE_TEST_MODE=true
 */
// eslint-disable-next-line react-refresh/only-export-components
export function isFrontendTestMode(): boolean {
  return IS_TEST_MODE;
}

/**
 * Get test user info from environment variables.
 * Used for displaying user info in test mode.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getTestUserInfo() {
  return {
    email: import.meta.env.VITE_TEST_USER_EMAIL || "test@example.com",
    name: import.meta.env.VITE_TEST_USER_NAME || "Test User",
    role: import.meta.env.VITE_TEST_USER_ROLE || "admin",
  };
}

/**
 * ConvexClientProvider - Wraps the application to provide Convex client with auth
 *
 * Handles missing VITE_CONVEX_URL gracefully for development without backend.
 * In test mode, skips auth and uses plain ConvexProvider.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    console.warn("VITE_CONVEX_URL is not set. Running without Convex backend.");
    // Create a dummy client for UI validation - queries will return undefined
    const dummyClient = new ConvexReactClient("https://placeholder.convex.cloud");
    return (
      <ConvexProvider client={dummyClient}>
        {children}
      </ConvexProvider>
    );
  }

  // In test mode, skip auth provider and use plain ConvexProvider
  // This allows the app to work without authentication
  if (IS_TEST_MODE) {
    console.log("[Test Mode] Running without authentication - using test user");
    return (
      <ConvexProvider client={convex}>
        {children}
      </ConvexProvider>
    );
  }

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromBetterAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

/**
 * Custom auth hook that fetches Convex tokens from Better Auth.
 * This replaces ConvexBetterAuthProvider to add debugging and proper error handling.
 */
function useAuthFromBetterAuth() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const sessionId = session?.session?.id;

  const fetchAccessToken = useCallback(async () => {
    try {
      console.log("[Convex Auth] Fetching access token...");
      console.log("[Convex Auth] Session ID:", sessionId);
      
      // Access the convex plugin methods with proper typing
      const convexPlugin = (authClient as unknown as { convex?: ConvexPluginMethods }).convex;
      console.log("[Convex Auth] authClient.convex available:", !!convexPlugin);

      if (!convexPlugin?.token) {
        console.error("[Convex Auth] authClient.convex.token is not available!");
        return null;
      }

      const result = await convexPlugin.token();
      console.log("[Convex Auth] Token result:", result);

      if (result.data?.token) {
        console.log("[Convex Auth] Got token, length:", result.data.token.length);
        return result.data.token;
      } else {
        console.warn("[Convex Auth] No token in response:", result);
        return null;
      }
    } catch (error) {
      console.error("[Convex Auth] Error fetching token:", error);
      return null;
    }
  }, [sessionId]);

  return useMemo(
    () => ({
      isLoading: isSessionPending,
      isAuthenticated: session !== null,
      fetchAccessToken,
    }),
    [isSessionPending, session, fetchAccessToken]
  );
}
