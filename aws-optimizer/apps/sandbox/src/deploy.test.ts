import { describe, it, expect, beforeAll } from "vitest";

/**
 * Deployment verification tests for the sandbox worker.
 * These tests verify the deployed worker endpoints are working correctly.
 *
 * Run with: SANDBOX_URL=https://your-worker.workers.dev npm run test:deploy
 *
 * Prerequisites:
 * - Worker must be deployed to Cloudflare
 * - SANDBOX_URL environment variable must be set
 * - TEST_AWS_ACCESS_KEY_ID and TEST_AWS_SECRET_ACCESS_KEY for /execute tests
 */

interface HealthResponse {
  status: string;
  awsCliVersion: string;
  sandboxReady: boolean;
  error?: string;
}

interface ExecuteResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

const SANDBOX_URL = process.env.SANDBOX_URL || "";
const TEST_AWS_ACCESS_KEY_ID = process.env.TEST_AWS_ACCESS_KEY_ID || "";
const TEST_AWS_SECRET_ACCESS_KEY = process.env.TEST_AWS_SECRET_ACCESS_KEY || "";
const TEST_AWS_REGION = process.env.TEST_AWS_REGION || "us-east-1";

describe.skipIf(!SANDBOX_URL)("Deployment Verification", () => {
  beforeAll(() => {
    if (!SANDBOX_URL) {
      console.log("Skipping deployment tests - SANDBOX_URL not set");
    }
  });

  describe("/health endpoint verification", () => {
    it("returns 200 with healthy status", async () => {
      const response = await fetch(`${SANDBOX_URL}/health`, {
        method: "GET",
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as HealthResponse;
      expect(body.status).toBe("ok");
      expect(body.sandboxReady).toBe(true);
      expect(body.awsCliVersion).toContain("aws-cli");
    });

    it("includes CORS headers", async () => {
      const response = await fetch(`${SANDBOX_URL}/health`, {
        method: "GET",
      });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("handles OPTIONS preflight", async () => {
      const response = await fetch(`${SANDBOX_URL}/health`, {
        method: "OPTIONS",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    });
  });

  describe.skipIf(!TEST_AWS_ACCESS_KEY_ID || !TEST_AWS_SECRET_ACCESS_KEY)(
    "/execute endpoint verification",
    () => {
      beforeAll(() => {
        if (!TEST_AWS_ACCESS_KEY_ID || !TEST_AWS_SECRET_ACCESS_KEY) {
          console.log(
            "Skipping /execute tests - TEST_AWS_ACCESS_KEY_ID or TEST_AWS_SECRET_ACCESS_KEY not set"
          );
        }
      });

      it("executes aws sts get-caller-identity successfully", async () => {
        const response = await fetch(`${SANDBOX_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "aws sts get-caller-identity",
            credentials: {
              accessKeyId: TEST_AWS_ACCESS_KEY_ID,
              secretAccessKey: TEST_AWS_SECRET_ACCESS_KEY,
              region: TEST_AWS_REGION,
            },
          }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as ExecuteResponse;
        expect(body.success).toBe(true);
        expect(body.exitCode).toBe(0);
        expect(body.stdout).toContain("Account");
        expect(body.executionTime).toBeGreaterThan(0);
      });

      it("rejects non-AWS commands", async () => {
        const response = await fetch(`${SANDBOX_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "ls -la",
            credentials: {
              accessKeyId: TEST_AWS_ACCESS_KEY_ID,
              secretAccessKey: TEST_AWS_SECRET_ACCESS_KEY,
            },
          }),
        });

        expect(response.status).toBe(400);

        const body = (await response.json()) as { error: string };
        expect(body.error).toBe("Only AWS CLI commands are allowed");
      });

      it("returns 400 for missing credentials", async () => {
        const response = await fetch(`${SANDBOX_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "aws s3 ls",
          }),
        });

        expect(response.status).toBe(400);

        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("Missing credentials");
      });

      it("returns 405 for GET requests", async () => {
        const response = await fetch(`${SANDBOX_URL}/execute`, {
          method: "GET",
        });

        expect(response.status).toBe(405);
      });
    }
  );

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await fetch(`${SANDBOX_URL}/unknown-route`, {
        method: "GET",
      });

      expect(response.status).toBe(404);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });
  });
});
