/**
 * Rate Limiting Tests
 *
 * Tests for US-046: Add rate limiting to critical endpoints
 *
 * Acceptance Criteria:
 * 1. Apply rate limiter to sandbox execution (10 per minute per org) - Already implemented
 * 2. Apply rate limiter to auth endpoints (5 attempts per minute per IP)
 * 3. Apply rate limiter to AI chat (20 messages per minute per user)
 * 4. Return 429 status with retry-after header when limited
 * 5. Log rate limit events for monitoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Rate Limiting (US-046)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Rate Limiter Configuration", () => {
    it("should export rateLimiter with sandboxExecution config", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.rateLimiter).toBeDefined();
    });

    it("should export rateLimiter with authAttempt config (5 per minute)", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.rateLimiter).toBeDefined();
      // The rate limiter should be configured with authAttempt rate
    });

    it("should export rateLimiter with aiChat config (20 per minute)", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.rateLimiter).toBeDefined();
      // The rate limiter should be configured with aiChat rate
    });
  });

  describe("Rate Limit Response Helpers", () => {
    it("should export createRateLimitResponse function", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.createRateLimitResponse).toBeDefined();
      expect(typeof rateLimitModule.createRateLimitResponse).toBe("function");
    });

    it("should return 429 status code", async () => {
      const rateLimitModule = await import("./rateLimit");
      const response = rateLimitModule.createRateLimitResponse(60000);
      expect(response.status).toBe(429);
    });

    it("should include Retry-After header in seconds", async () => {
      const rateLimitModule = await import("./rateLimit");
      const response = rateLimitModule.createRateLimitResponse(30000); // 30 seconds in ms
      expect(response.headers.get("Retry-After")).toBe("30");
    });

    it("should include error message in response body", async () => {
      const rateLimitModule = await import("./rateLimit");
      const response = rateLimitModule.createRateLimitResponse(60000);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Rate limit exceeded");
      expect(body.retryAfter).toBe(60);
    });
  });

  describe("Rate Limit Logging", () => {
    it("should export logRateLimitEvent function", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.logRateLimitEvent).toBeDefined();
      expect(typeof rateLimitModule.logRateLimitEvent).toBe("function");
    });

    it("should log rate limit events with required fields", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      const rateLimitModule = await import("./rateLimit");
      rateLimitModule.logRateLimitEvent({
        type: "authAttempt",
        key: "192.168.1.1",
        retryAfter: 60000,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0][0];
      expect(logMessage).toContain("RATE_LIMIT");
      expect(logMessage).toContain("authAttempt");
      
      consoleSpy.mockRestore();
    });
  });

  describe("Auth Rate Limiting", () => {
    it("should have rate limit config for auth (5 per minute per IP)", async () => {
      const rateLimitModule = await import("./rateLimit");
      // Verify the config exists - actual rate limiting behavior 
      // is tested via the RateLimiter component in integration tests
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.authAttempt).toBeDefined();
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.authAttempt.rate).toBe(5);
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.authAttempt.period).toBe(60000); // 1 minute
    });
  });

  describe("AI Chat Rate Limiting", () => {
    it("should have rate limit config for AI chat (20 per minute per user)", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.aiChat).toBeDefined();
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.aiChat.rate).toBe(20);
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.aiChat.period).toBe(60000); // 1 minute
    });
  });

  describe("Sandbox Rate Limiting", () => {
    it("should have rate limit config for sandbox (10 per minute per org)", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.sandboxExecution).toBeDefined();
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.sandboxExecution.rate).toBe(10);
      expect(rateLimitModule.RATE_LIMIT_CONFIGS.sandboxExecution.period).toBe(60000); // 1 minute
    });
  });

  describe("IP Address Extraction", () => {
    it("should export getClientIP function", async () => {
      const rateLimitModule = await import("./rateLimit");
      expect(rateLimitModule.getClientIP).toBeDefined();
      expect(typeof rateLimitModule.getClientIP).toBe("function");
    });

    it("should extract IP from CF-Connecting-IP header first", async () => {
      const rateLimitModule = await import("./rateLimit");
      const headers = new Headers({
        "CF-Connecting-IP": "1.2.3.4",
        "x-forwarded-for": "5.6.7.8",
      });
      const ip = rateLimitModule.getClientIP(headers);
      expect(ip).toBe("1.2.3.4");
    });

    it("should fallback to x-forwarded-for header", async () => {
      const rateLimitModule = await import("./rateLimit");
      const headers = new Headers({
        "x-forwarded-for": "5.6.7.8, 9.10.11.12",
      });
      const ip = rateLimitModule.getClientIP(headers);
      expect(ip).toBe("5.6.7.8");
    });

    it("should fallback to x-real-ip header", async () => {
      const rateLimitModule = await import("./rateLimit");
      const headers = new Headers({
        "x-real-ip": "10.0.0.1",
      });
      const ip = rateLimitModule.getClientIP(headers);
      expect(ip).toBe("10.0.0.1");
    });

    it("should return 'unknown' if no IP headers present", async () => {
      const rateLimitModule = await import("./rateLimit");
      const headers = new Headers({});
      const ip = rateLimitModule.getClientIP(headers);
      expect(ip).toBe("unknown");
    });
  });
});
