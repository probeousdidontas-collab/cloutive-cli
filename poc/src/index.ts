import { getSandbox, Sandbox } from "@cloudflare/sandbox";

// Re-export Sandbox class for Durable Object binding
export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace;
}

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

interface ExecuteResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface HealthResponse {
  status: string;
  awsCliVersion: string;
  sandboxReady: boolean;
  error?: string;
}

/**
 * Sets up AWS credentials inside the sandbox container
 */
async function setupCredentials(
  sandbox: ReturnType<typeof getSandbox>,
  credentials: AwsCredentials
): Promise<void> {
  const region = credentials.region || "us-east-1";

  // Create AWS credentials file content
  const credentialsContent = credentials.sessionToken
    ? `[default]
aws_access_key_id = ${credentials.accessKeyId}
aws_secret_access_key = ${credentials.secretAccessKey}
aws_session_token = ${credentials.sessionToken}
`
    : `[default]
aws_access_key_id = ${credentials.accessKeyId}
aws_secret_access_key = ${credentials.secretAccessKey}
`;

  // Create AWS config file content
  const configContent = `[default]
region = ${region}
output = json
`;

  // Write credentials and config files to sandbox
  await sandbox.writeFile("/root/.aws/credentials", credentialsContent);
  await sandbox.writeFile("/root/.aws/config", configContent);
}

/**
 * Handles the /health endpoint
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const response: HealthResponse = {
    status: "ok",
    awsCliVersion: "",
    sandboxReady: false,
  };

  try {
    const sandbox = getSandbox(env.Sandbox, "aws-sandbox");
    const result = await sandbox.exec("aws --version");

    response.sandboxReady = true;
    response.awsCliVersion = result.stdout?.trim() || result.stderr?.trim() || "";

    if (result.exitCode !== 0) {
      response.status = "degraded";
      response.error = "AWS CLI returned non-zero exit code";
    }
  } catch (error) {
    response.status = "error";
    response.error = error instanceof Error ? error.message : "Unknown error";
  }

  return new Response(JSON.stringify(response, null, 2), {
    headers: { "Content-Type": "application/json" },
    status: response.status === "ok" ? 200 : 503,
  });
}

/**
 * Handles the /execute endpoint
 */
async function handleExecute(request: Request, env: Env): Promise<Response> {
  // Validate request method
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let body: ExecuteRequest;
  try {
    body = (await request.json()) as ExecuteRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate required fields
  if (!body.command || typeof body.command !== "string") {
    return new Response(JSON.stringify({ error: "Missing or invalid 'command' field" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.credentials || !body.credentials.accessKeyId || !body.credentials.secretAccessKey) {
    return new Response(
      JSON.stringify({ error: "Missing credentials (accessKeyId and secretAccessKey required)" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Security: ensure command starts with 'aws'
  const trimmedCommand = body.command.trim();
  if (!trimmedCommand.startsWith("aws ") && trimmedCommand !== "aws") {
    return new Response(JSON.stringify({ error: "Only AWS CLI commands are allowed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const response: ExecuteResponse = {
    success: false,
    stdout: "",
    stderr: "",
    exitCode: -1,
    executionTime: 0,
  };

  try {
    const sandbox = getSandbox(env.Sandbox, "aws-sandbox");

    // Set up AWS credentials in the sandbox
    await setupCredentials(sandbox, body.credentials);

    // Execute the command
    const result = await sandbox.exec(trimmedCommand);

    response.success = result.exitCode === 0;
    response.stdout = result.stdout || "";
    response.stderr = result.stderr || "";
    response.exitCode = result.exitCode ?? -1;
  } catch (error) {
    response.stderr = error instanceof Error ? error.message : "Unknown error";
  }

  response.executionTime = Date.now() - startTime;

  return new Response(JSON.stringify(response, null, 2), {
    headers: { "Content-Type": "application/json" },
    status: response.success ? 200 : 500,
  });
}

/**
 * Main fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for local development
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    switch (path) {
      case "/health":
        response = await handleHealthCheck(env);
        break;

      case "/execute":
        response = await handleExecute(request, env);
        break;

      default:
        response = new Response(
          JSON.stringify({
            error: "Not found",
            availableEndpoints: [
              { method: "GET", path: "/health" },
              { method: "POST", path: "/execute" },
            ],
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
