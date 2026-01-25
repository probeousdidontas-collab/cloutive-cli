import { describe, test, expect } from "vitest";

/**
 * US-019 Acceptance Criteria Integration Tests
 * 
 * These tests verify that the frontend is properly scaffolded according to
 * the acceptance criteria for the user story.
 */
describe("US-019: React Frontend Setup", () => {
  describe("AC1: Vite React TypeScript project in apps/web", () => {
    test("should have React available", async () => {
      const React = await import("react");
      expect(React.createElement).toBeDefined();
      expect(React.useState).toBeDefined();
    });

    test("should have ReactDOM available", async () => {
      const ReactDOM = await import("react-dom/client");
      expect(ReactDOM.createRoot).toBeDefined();
    });
  });

  describe("AC2: Mantine v8 with theme configuration", () => {
    test("should have Mantine core available", async () => {
      const Mantine = await import("@mantine/core");
      expect(Mantine.MantineProvider).toBeDefined();
      expect(Mantine.createTheme).toBeDefined();
    });

    test("should have Mantine notifications available", async () => {
      const MantineNotifications = await import("@mantine/notifications");
      expect(MantineNotifications.Notifications).toBeDefined();
    });

    test("should have theme with AWS branding", async () => {
      const { theme } = await import("./lib/theme");
      expect(theme.primaryColor).toBe("awsOrange");
      expect(theme.colors?.awsOrange).toBeDefined();
    });
  });

  describe("AC3: TanStack Router setup", () => {
    test("should have TanStack Router available", async () => {
      const TanStackRouter = await import("@tanstack/react-router");
      expect(TanStackRouter.createRouter).toBeDefined();
      expect(TanStackRouter.createRootRoute).toBeDefined();
      expect(TanStackRouter.createRoute).toBeDefined();
      expect(TanStackRouter.RouterProvider).toBeDefined();
    });

    test("should export configured router", async () => {
      const { router } = await import("./router");
      expect(router).toBeDefined();
      expect(router.routeTree).toBeDefined();
    });
  });

  describe("AC4: Convex client provider", () => {
    test("should have Convex available", async () => {
      const Convex = await import("convex/react");
      expect(Convex.ConvexProvider).toBeDefined();
      expect(Convex.ConvexReactClient).toBeDefined();
    });

    test("should export ConvexClientProvider", async () => {
      const { ConvexClientProvider } = await import("./lib/convex");
      expect(ConvexClientProvider).toBeDefined();
      expect(typeof ConvexClientProvider).toBe("function");
    });
  });

  describe("AC5: MobX stores with RootStore pattern", () => {
    test("should have MobX available", async () => {
      const MobX = await import("mobx");
      expect(MobX.makeAutoObservable).toBeDefined();
    });

    test("should have mobx-react-lite available", async () => {
      const MobXReact = await import("mobx-react-lite");
      expect(MobXReact.observer).toBeDefined();
    });

    test("should export RootStore class", async () => {
      const { RootStore } = await import("./stores");
      expect(RootStore).toBeDefined();
      const store = new RootStore();
      expect(store).toBeInstanceOf(RootStore);
    });

    test("should export StoreProvider", async () => {
      const { StoreProvider } = await import("./stores");
      expect(StoreProvider).toBeDefined();
      expect(typeof StoreProvider).toBe("function");
    });

    test("should export useStores hook", async () => {
      const { useStores } = await import("./stores");
      expect(useStores).toBeDefined();
      expect(typeof useStores).toBe("function");
    });

    test("should export getRootStore singleton getter", async () => {
      const { getRootStore } = await import("./stores");
      expect(getRootStore).toBeDefined();
      expect(typeof getRootStore).toBe("function");
    });
  });

  describe("AC6: App structure follows pruva-admin pattern", () => {
    test("should have App component", async () => {
      const { App } = await import("./App");
      expect(App).toBeDefined();
      expect(typeof App).toBe("function");
    });
  });
});
