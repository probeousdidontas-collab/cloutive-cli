import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for AWS Optimizer frontend.
 * 
 * Connects to the Convex backend's Better Auth endpoints.
 * Uses same-origin requests (empty baseURL) to work with the proxy.
 */

/**
 * Get the base URL for Better Auth requests.
 * In development: Use VITE_CONVEX_SITE_URL to point to Convex directly
 * In production: Use empty string for same-origin requests via proxy
 * 
 * The production worker proxies /api/auth/* to Convex site.
 */
const getAuthBaseUrl = () => {
  // In development, use the Convex site URL directly
  if (import.meta.env.DEV && import.meta.env.VITE_CONVEX_SITE_URL) {
    return import.meta.env.VITE_CONVEX_SITE_URL;
  }
  // In production, use same-origin (requests proxied by worker to Convex)
  return "";
};

const AUTH_BASE_URL = getAuthBaseUrl();

/**
 * Auth client instance for Better Auth.
 * Provides methods for sign-in, sign-up, password reset, and session management.
 */
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  fetchOptions: {
    credentials: "include", // Send cookies with auth requests
  },
});

// Export hooks and methods from auth client
export const { signIn, signUp, signOut, getSession, useSession } = authClient;

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
