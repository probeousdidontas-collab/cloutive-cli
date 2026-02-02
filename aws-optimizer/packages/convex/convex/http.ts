/**
 * HTTP Routes for AWS Optimizer
 *
 * Sets up HTTP endpoints including:
 * - Better Auth routes for authentication
 * - Stripe webhook handler for subscription events
 * - Feedback REST API for bug reports and feature requests
 */

import { httpRouter } from "convex/server";
import { authClient, createAuth } from "./auth";
import { registerFeedbackRoutes } from "@fatagnus/convex-feedback";
import { components } from "./_generated/api";
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

// Feedback REST API at /feedback/*
registerFeedbackRoutes(http, { pathPrefix: "/feedback", component: components.feedback });

export default http;
