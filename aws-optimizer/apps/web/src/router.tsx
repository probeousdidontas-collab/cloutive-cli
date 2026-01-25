import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { App } from "./App";
import { LoginPage, SignupPage, ForgotPasswordPage } from "./pages";

// Root route
const rootRoute = createRootRoute({
  component: App,
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>AWS Cost Optimizer</h1>
      <p>AI-first AWS cost analysis and optimization platform</p>
    </div>
  ),
});

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// Signup route
const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

// Forgot password route
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

// Chat route (placeholder for redirect target)
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: () => (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>AI Chat</h1>
      <p>Chat interface for AWS cost analysis</p>
    </div>
  ),
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  chatRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Type safety for router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
