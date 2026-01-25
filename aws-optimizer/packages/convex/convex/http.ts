/**
 * HTTP Routes for AWS Optimizer
 *
 * Sets up HTTP endpoints including:
 * - Better Auth routes for authentication
 * - Stripe webhook handler for subscription events
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authClient, createAuth } from "./auth";
import { Stripe } from "@convex-dev/stripe";
import { components } from "./_generated/api";

const http = httpRouter();

// Register Better Auth routes for authentication endpoints (/api/auth/*)
authClient.registerRoutes(http, createAuth, { cors: true });

// Initialize Stripe component for webhook handling
const stripe = new Stripe(components.stripe, {
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
});

// Register Stripe webhook handler at /stripe/webhook
// The @convex-dev/stripe component handles webhook signature verification automatically
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: stripe.webhook,
});

export default http;
