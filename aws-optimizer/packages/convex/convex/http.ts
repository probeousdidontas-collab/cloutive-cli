/**
 * HTTP Routes for AWS Optimizer
 *
 * Sets up HTTP endpoints including:
 * - Better Auth routes for authentication (with rate limiting)
 * - Stripe webhook handler for subscription events
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authClient, createAuth } from "./auth";
// Note: Stripe webhook routes can be enabled by uncommenting below
// import { registerRoutes } from "@convex-dev/stripe";
import {
  rateLimiter,
  getClientIP,
  createRateLimitResponse,
  logRateLimitEvent,
} from "./rateLimit";

const http = httpRouter();

/**
 * Rate-limited auth handler.
 * Checks rate limit before forwarding to Better Auth.
 * Applies 5 attempts per minute per IP to auth endpoints.
 */
const rateLimitedAuthHandler = httpAction(async (ctx, request) => {
  const clientIP = getClientIP(request.headers);

  // Check rate limit for auth attempts
  const rateLimitResult = await rateLimiter.limit(ctx, "authAttempt", {
    key: clientIP,
    throws: false,
  });

  if (!rateLimitResult.ok) {
    // Log the rate limit event for monitoring
    logRateLimitEvent({
      type: "authAttempt",
      key: clientIP,
      retryAfter: rateLimitResult.retryAfter,
    });

    // Return 429 with Retry-After header
    const response = createRateLimitResponse(rateLimitResult.retryAfter);
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  // Forward to Better Auth handler
  const auth = createAuth(ctx);
  return auth.handler(request);
});

// Register rate-limited auth routes for sign-in and sign-up endpoints
// These are the critical endpoints that need protection from brute force attacks
http.route({
  path: "/api/auth/sign-in/email",
  method: "POST",
  handler: rateLimitedAuthHandler,
});

http.route({
  path: "/api/auth/sign-up/email",
  method: "POST",
  handler: rateLimitedAuthHandler,
});

// Register remaining Better Auth routes (session, signout, etc.) without rate limiting
// These don't need rate limiting as they require valid sessions
authClient.registerRoutes(http, createAuth, { cors: true });

// Register Stripe webhook routes
// The @convex-dev/stripe component handles webhook signature verification automatically
// Note: Requires stripe component to be installed in convex.config.ts
// registerRoutes(http, components.stripe);

export default http;
