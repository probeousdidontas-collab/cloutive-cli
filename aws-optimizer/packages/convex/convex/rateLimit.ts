/**
 * Rate Limiting Configuration and Helpers
 *
 * Implements US-046: Add rate limiting to critical endpoints
 *
 * Features:
 * - Centralized rate limiter configuration for all endpoints
 * - Helper functions for 429 responses with Retry-After header
 * - IP address extraction for auth rate limiting
 * - Logging for monitoring rate limit events
 */

import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// ============================================================================
// Rate Limit Configuration Constants
// ============================================================================

/**
 * Rate limit configurations for different endpoint types.
 * Exported for testing and documentation purposes.
 */
export const RATE_LIMIT_CONFIGS = {
  // Sandbox execution: 10 commands per minute per organization
  sandboxExecution: {
    kind: "fixed window" as const,
    rate: 10,
    period: 60 * 1000, // 1 minute in ms
  },
  // Auth attempts: 5 attempts per minute per IP address
  authAttempt: {
    kind: "fixed window" as const,
    rate: 5,
    period: 60 * 1000, // 1 minute in ms
  },
  // AI chat messages: 20 messages per minute per user
  aiChat: {
    kind: "fixed window" as const,
    rate: 20,
    period: 60 * 1000, // 1 minute in ms
  },
};

// ============================================================================
// Rate Limiter Instance
// ============================================================================

/**
 * Centralized rate limiter instance with all configured limits.
 * Uses the @convex-dev/rate-limiter component.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sandboxExecution: RATE_LIMIT_CONFIGS.sandboxExecution,
  authAttempt: RATE_LIMIT_CONFIGS.authAttempt,
  aiChat: RATE_LIMIT_CONFIGS.aiChat,
});

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a standardized 429 Too Many Requests response.
 * Includes Retry-After header as required by HTTP spec.
 *
 * @param retryAfterMs - Time in milliseconds until the rate limit resets
 * @returns Response object with 429 status and Retry-After header
 */
export function createRateLimitResponse(retryAfterMs: number): {
  status: number;
  headers: Headers;
  body: string;
} {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  const headers = new Headers({
    "Content-Type": "application/json",
    "Retry-After": String(retryAfterSeconds),
  });

  const body = JSON.stringify({
    error: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
    retryAfter: retryAfterSeconds,
  });

  return {
    status: 429,
    headers,
    body,
  };
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Rate limit event types for logging.
 */
export type RateLimitEventType = "sandboxExecution" | "authAttempt" | "aiChat";

/**
 * Rate limit event structure for monitoring.
 */
export interface RateLimitEvent {
  type: RateLimitEventType;
  key: string;
  retryAfter: number;
}

/**
 * Log a rate limit event for monitoring purposes.
 * Uses console.warn to ensure visibility in logs.
 *
 * @param event - The rate limit event to log
 */
export function logRateLimitEvent(event: RateLimitEvent): void {
  const timestamp = new Date().toISOString();
  const retryAfterSeconds = Math.ceil(event.retryAfter / 1000);

  console.warn(
    `[RATE_LIMIT] ${timestamp} | Type: ${event.type} | Key: ${event.key} | RetryAfter: ${retryAfterSeconds}s`
  );
}

// ============================================================================
// IP Address Extraction
// ============================================================================

/**
 * Extract client IP address from request headers.
 * Checks headers in order of preference:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. x-forwarded-for (first IP in chain)
 * 3. x-real-ip
 *
 * @param headers - Request headers
 * @returns Client IP address or "unknown" if not found
 */
export function getClientIP(headers: Headers): string {
  // Cloudflare header (most reliable when using CF)
  const cfIP = headers.get("CF-Connecting-IP");
  if (cfIP) {
    return cfIP.trim();
  }

  // x-forwarded-for can contain multiple IPs, use the first one
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIP = xForwardedFor.split(",")[0];
    return firstIP.trim();
  }

  // Fallback to x-real-ip
  const xRealIP = headers.get("x-real-ip");
  if (xRealIP) {
    return xRealIP.trim();
  }

  return "unknown";
}

// ============================================================================
// Rate Limit Check Helpers
// ============================================================================

/**
 * Check rate limit and throw error if exceeded.
 * Used by mutations/actions to enforce rate limits.
 *
 * @param ctx - Convex action/mutation context
 * @param type - Rate limit type
 * @param key - Unique key for rate limiting (e.g., userId, IP, orgId)
 * @throws Error with rate limit message if limit exceeded
 */
export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  type: RateLimitEventType,
  key: string
): Promise<void> {
  const result = await rateLimiter.limit(ctx, type, {
    key,
    throws: false,
  });

  if (!result.ok) {
    // Log the rate limit event for monitoring
    logRateLimitEvent({
      type,
      key,
      retryAfter: result.retryAfter,
    });

    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter / 1000)} seconds.`
    );
  }
}
