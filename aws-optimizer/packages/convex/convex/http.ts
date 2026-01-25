/**
 * HTTP Routes for AWS Optimizer
 *
 * Sets up HTTP endpoints including Better Auth routes for authentication.
 */

import { httpRouter } from "convex/server";
import { authClient, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes for authentication endpoints (/api/auth/*)
authClient.registerRoutes(http, createAuth, { cors: true });

export default http;
