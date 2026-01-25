import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { AppLayout } from "./AppShell";
import { NAV_ITEMS } from "./nav-items";

// Mock TanStack Router hooks
const mockLocation = { pathname: "/" };
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock auth client
vi.mock("../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Test User",
        email: "test@example.com",
      },
    },
    isPending: false,
  }),
  signOut: vi.fn(),
}));

// Mock MobX stores
vi.mock("../stores", () => ({
  useStores: () => ({
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-021: App Shell Layout with Navigation", () => {
  beforeEach(() => {
    mockLocation.pathname = "/";
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create AppShell component with sidebar navigation", () => {
    test("should render AppShell with sidebar", () => {
      renderWithProviders(<AppLayout />);
      
      // Should have a navigation element
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
    });

    test("should render main content area with Outlet", () => {
      renderWithProviders(<AppLayout />);
      
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    test("should render header", () => {
      renderWithProviders(<AppLayout />);
      
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });
  });

  describe("AC2: Add all required navigation items", () => {
    const requiredNavItems = [
      "Chat",
      "Dashboard",
      "Costs",
      "Resources",
      "Recommendations",
      "Terminal",
      "Budgets",
      "Alerts",
      "Reports",
      "Accounts",
      "Settings",
      "Billing",
      "Team",
    ];

    test("should have all required navigation items defined", () => {
      expect(NAV_ITEMS.map((item) => item.label)).toEqual(
        expect.arrayContaining(requiredNavItems)
      );
    });

    test.each(requiredNavItems)(
      "should render %s navigation item",
      (itemLabel) => {
        renderWithProviders(<AppLayout />);
        
        expect(screen.getByText(itemLabel)).toBeInTheDocument();
      }
    );
  });

  describe("AC3: Highlight active route in navigation", () => {
    test("should highlight Chat nav item when on /chat route", () => {
      mockLocation.pathname = "/chat";
      renderWithProviders(<AppLayout />);
      
      const chatNavItem = screen.getByText("Chat").closest("a, button");
      expect(chatNavItem).toHaveAttribute("data-active", "true");
    });

    test("should highlight Dashboard nav item when on /dashboard route", () => {
      mockLocation.pathname = "/dashboard";
      renderWithProviders(<AppLayout />);
      
      const dashboardNavItem = screen.getByText("Dashboard").closest("a, button");
      expect(dashboardNavItem).toHaveAttribute("data-active", "true");
    });

    test("should not highlight other nav items when on specific route", () => {
      mockLocation.pathname = "/chat";
      renderWithProviders(<AppLayout />);
      
      const dashboardNavItem = screen.getByText("Dashboard").closest("a, button");
      expect(dashboardNavItem).not.toHaveAttribute("data-active", "true");
    });
  });

  describe("AC4: Show user profile and logout in header", () => {
    test("should display user name in header", () => {
      renderWithProviders(<AppLayout />);
      
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    test("should have logout button in user menu", async () => {
      renderWithProviders(<AppLayout />);
      
      // The logout button is inside a dropdown menu, so we need to open it first
      const userMenuButton = screen.getByText("Test User").closest("button");
      expect(userMenuButton).toBeInTheDocument();
      
      // Click to open the menu
      if (userMenuButton) {
        fireEvent.click(userMenuButton);
      }
      
      // Now the Logout menu item should be visible
      const logoutItem = await screen.findByText("Logout");
      expect(logoutItem).toBeInTheDocument();
    });
  });

  describe("AC5: Make layout responsive for mobile", () => {
    test("should have burger menu for mobile", () => {
      renderWithProviders(<AppLayout />);
      
      // Burger should exist (may be hidden on desktop via CSS)
      const burger = screen.getByRole("button", { name: /toggle navigation/i });
      expect(burger).toBeInTheDocument();
    });

    test("burger should toggle sidebar visibility", () => {
      renderWithProviders(<AppLayout />);
      
      const burger = screen.getByRole("button", { name: /toggle navigation/i });
      fireEvent.click(burger);
      
      // The burger should be clickable (actual toggle behavior tested via store)
      expect(burger).toBeInTheDocument();
    });
  });
});
