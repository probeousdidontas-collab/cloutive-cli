import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { App } from "./App";

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

// Route tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Create router
export const router = createRouter({ routeTree });

// Type safety for router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
