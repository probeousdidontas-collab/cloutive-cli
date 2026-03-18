import { createRouter, createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { LoginPage, SignupPage, ForgotPasswordPage, ChatPage, AccountsPage, DashboardPage, CostExplorerPage, ResourcesPage, RecommendationsPage, TerminalPage, BudgetsPage, AlertsPage, ReportsPage, BillingPage, TeamPage, SettingsPage, PartnerPage, LandingPage, ActivityPage, AcceptInvitationPage, FeedbackAdminPage, CronManagementPage, AIPromptsPage } from "./pages";
import { AppLayout } from "./components/AppShell";

// Root route - just renders Outlet, no layout
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Auth layout route (no sidebar) - for login, signup, forgot-password, landing
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  component: () => <Outlet />,
});

// Index route - landing page (public, no auth required)
const indexRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/",
  component: LandingPage,
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

// Accept invitation route (public, no auth required)
const acceptInvitationRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/accept-invitation/$invitationId",
  component: AcceptInvitationPage,
});

// App layout route - wraps all authenticated pages with sidebar navigation
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
});

// Chat route
const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/chat",
  component: ChatPage,
});

// Dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/dashboard",
  component: DashboardPage,
});

// Costs route
const costsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/costs",
  component: CostExplorerPage,
});

// Resources route
const resourcesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/resources",
  component: ResourcesPage,
});

// Recommendations route
const recommendationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/recommendations",
  component: RecommendationsPage,
});

// Terminal route
const terminalRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/terminal",
  component: TerminalPage,
});

// Budgets route
const budgetsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/budgets",
  component: BudgetsPage,
});

// Alerts route
const alertsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/alerts",
  component: AlertsPage,
});

// Reports route
const reportsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/reports",
  component: ReportsPage,
});

// Accounts route
const accountsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/accounts",
  component: AccountsPage,
});

// Settings route
const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

// Activity route (settings/activity)
const activityRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/activity",
  component: ActivityPage,
});

// Billing route
const billingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/billing",
  component: BillingPage,
});

// Team route
const teamRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/team",
  component: TeamPage,
});

// Partner route
const partnerRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/partner",
  component: PartnerPage,
});

// Feedback Admin route
const feedbackAdminRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/feedback-admin",
  component: FeedbackAdminPage,
});

// Cron Management route
const cronManagementRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/cron-management",
  component: CronManagementPage,
});

// AI Prompts route
const aiPromptsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/prompts",
  component: AIPromptsPage,
});

// Route tree - authLayoutRoute contains auth-related routes (no sidebar)
// appLayoutRoute contains all authenticated routes (with sidebar)
const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([
    indexRoute,
    loginRoute,
    signupRoute,
    forgotPasswordRoute,
    acceptInvitationRoute,
  ]),
  appLayoutRoute.addChildren([
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
    activityRoute,
    billingRoute,
    teamRoute,
    partnerRoute,
    feedbackAdminRoute,
    cronManagementRoute,
    aiPromptsRoute,
  ]),
]);

// Create router
export const router = createRouter({ routeTree });

// Type safety for router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
