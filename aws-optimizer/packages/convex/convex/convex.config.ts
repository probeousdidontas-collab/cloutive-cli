import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import agent from "@convex-dev/agent/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import stripe from "@convex-dev/stripe/convex.config.js";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();

// Rate limiting for sandbox execution and API endpoints
app.use(rateLimiter);

// Email notifications via Resend
app.use(resend);

// AI Agent for autonomous AWS analysis
app.use(agent);

// Job queue with priority support
app.use(workpool);

// Retry failed external calls
app.use(actionRetrier);

// Stripe billing integration
app.use(stripe);

// Authentication via Better Auth
app.use(betterAuth);

export default app;
