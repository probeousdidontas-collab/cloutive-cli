import { createRouter, createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "./components/AppShell";
import { LoginPage, SignupPage, ForgotPasswordPage, ChatPage, AccountsPage, DashboardPage, CostExplorerPage, ResourcesPage } from "./pages";
import { Title, Text, Container, Stack } from "@mantine/core";

// Placeholder page component factory
function createPlaceholderPage(title: string, description: string) {
  const PlaceholderPage = () => (
    <Container size="lg" py="xl">
      <Stack align="center" gap="md">
        <Title order={1}>{title}</Title>
        <Text c="dimmed" size="lg" ta="center">
          {description}
        </Text>
      </Stack>
    </Container>
  );
  PlaceholderPage.displayName = `${title.replace(/\s+/g, "")}Page`;
  return PlaceholderPage;
}

// Root route - just renders Outlet, no layout
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Auth layout route (no sidebar) - for login, signup, forgot-password
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  component: () => <Outlet />,
});

// App layout route (with sidebar) - for authenticated pages
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
});

// Index route - redirects to chat
const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: createPlaceholderPage(
    "Welcome to AWS Cost Optimizer",
    "AI-first AWS cost analysis and optimization platform"
  ),
});

// Login route (under auth layout - no sidebar)
const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  component: LoginPage,
});

// Signup route (under auth layout - no sidebar)
const signupRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/signup",
  component: SignupPage,
});

// Forgot password route (under auth layout - no sidebar)
const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

// Chat route
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatPage,
});

// Dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

// Costs route
const costsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/costs",
  component: CostExplorerPage,
});

// Resources route
const resourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/resources",
  component: ResourcesPage,
});

// Recommendations route
const recommendationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recommendations",
  component: createPlaceholderPage(
    "Recommendations",
    "AI-powered cost optimization recommendations"
  ),
});

// Terminal route
const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terminal",
  component: createPlaceholderPage(
    "Terminal",
    "AWS CLI terminal interface"
  ),
});

// Budgets route
const budgetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/budgets",
  component: createPlaceholderPage(
    "Budgets",
    "Budget management and tracking"
  ),
});

// Alerts route
const alertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/alerts",
  component: createPlaceholderPage(
    "Alerts",
    "Cost alerts and notifications"
  ),
});

// Reports route
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: createPlaceholderPage(
    "Reports",
    "Generate and view cost reports"
  ),
});

// Accounts route
const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts",
  component: AccountsPage,
});

// Settings route
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: createPlaceholderPage(
    "Settings",
    "Application and user settings"
  ),
});

// Billing route
const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  component: createPlaceholderPage(
    "Billing",
    "Subscription and billing management"
  ),
});

// Team route
const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team",
  component: createPlaceholderPage(
    "Team",
    "Team members and permissions"
  ),
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  chatRoute,
  dashboardRoute,
  costsRoute,
  resourcesRoute,
  recommendationsRoute,
  terminalRoute,
  budgetsRoute,
  alertsRoute,
  reportsRoute,
  accountsRoute,
  settingsRoute,
  billingRoute,
  teamRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Type safety for router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
