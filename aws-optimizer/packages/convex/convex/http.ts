/**
 * HTTP Routes for AWS Optimizer
 *
 * Sets up HTTP endpoints including:
 * - Better Auth routes for authentication
 * - Stripe webhook handler for subscription events
 */

import { httpRouter } from "convex/server";
import { authClient, createAuth } from "./auth";
// Note: Stripe webhook routes can be enabled by uncommenting below
// import { registerRoutes } from "@convex-dev/stripe";

const http = httpRouter();

// Register Better Auth routes for authentication
// Handles sign-in, sign-up, session management, etc.
authClient.registerRoutes(http, createAuth, { cors: true });

// Register Stripe webhook routes
// The @convex-dev/stripe component handles webhook signature verification automatically
// Note: Requires stripe component to be installed in convex.config.ts
// registerRoutes(http, components.stripe);

export default http;
