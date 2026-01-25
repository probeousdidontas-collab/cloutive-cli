import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { AlertsPage } from "./AlertsPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock alerts data with various types and statuses
const mockAlerts = [
  {
    _id: "alert-1",
    organizationId: "org-1",
    type: "budget_exceeded",
    title: "Monthly Budget Exceeded",
    message: "Your monthly cloud budget of $10,000 has been exceeded. Current spend: $10,500.",
    severity: "critical",
    triggeredAt: Date.now() - 3600000, // 1 hour ago
    acknowledgedAt: undefined,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "alert-2",
    organizationId: "org-1",
    type: "anomaly_detected",
    title: "Unusual Spending Pattern",
    message: "Detected a 150% increase in EC2 costs compared to the previous week.",
    severity: "warning",
    triggeredAt: Date.now() - 7200000, // 2 hours ago
    acknowledgedAt: undefined,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
  {
    _id: "alert-3",
    organizationId: "org-1",
    type: "recommendation_available",
    title: "New Savings Opportunity",
    message: "3 new cost optimization recommendations are available. Potential savings: $250/month.",
    severity: "info",
    triggeredAt: Date.now() - 86400000, // 1 day ago
    acknowledgedAt: Date.now() - 43200000, // acknowledged 12 hours ago
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 43200000,
  },
  {
    _id: "alert-4",
    organizationId: "org-1",
    type: "cost_spike",
    title: "Cost Spike Detected",
    message: "S3 storage costs increased by 200% in the last 24 hours.",
    severity: "warning",
    triggeredAt: Date.now() - 172800000, // 2 days ago
    acknowledgedAt: undefined,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
  {
    _id: "alert-5",
    organizationId: "org-1",
    type: "resource_idle",
    title: "Idle Resources Detected",
    message: "5 EC2 instances have been idle for more than 7 days.",
    severity: "info",
    triggeredAt: Date.now() - 259200000, // 3 days ago
    acknowledgedAt: Date.now() - 172800000, // acknowledged 2 days ago
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 172800000,
  },
];

const mockAcknowledgeMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockAlerts),
  useMutation: vi.fn(() => mockAcknowledgeMutation),
}));

// Mock auth client
vi.mock("../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      },
    },
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-030: Alerts Page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAcknowledgeMutation.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /alerts route with alert history", () => {
    test("should render alerts page", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("alerts-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByRole("heading", { name: /alerts/i })).toBeInTheDocument();
    });

    test("should display list of alerts", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByText("Monthly Budget Exceeded")).toBeInTheDocument();
      expect(screen.getByText("Unusual Spending Pattern")).toBeInTheDocument();
      expect(screen.getByText("New Savings Opportunity")).toBeInTheDocument();
    });

    test("should have alerts list container", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("alerts-list")).toBeInTheDocument();
    });

    test("should display each alert as a card or row", () => {
      renderWithProviders(<AlertsPage />);
      
      const alertItems = screen.getAllByTestId(/alert-item-/);
      expect(alertItems.length).toBe(5);
    });
  });

  describe("AC2: Display alert type, title, message, severity, and timestamp", () => {
    test("should display alert type", () => {
      renderWithProviders(<AlertsPage />);
      
      // Should show type badges
      expect(screen.getAllByText(/budget/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/anomaly/i).length).toBeGreaterThan(0);
    });

    test("should display alert title", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByText("Monthly Budget Exceeded")).toBeInTheDocument();
      expect(screen.getByText("Unusual Spending Pattern")).toBeInTheDocument();
      expect(screen.getByText("Cost Spike Detected")).toBeInTheDocument();
    });

    test("should display alert message", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByText(/Your monthly cloud budget of \$10,000 has been exceeded/)).toBeInTheDocument();
    });

    test("should display alert severity", () => {
      renderWithProviders(<AlertsPage />);
      
      // Should show severity badges or indicators
      expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/warning/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/info/i).length).toBeGreaterThan(0);
    });

    test("should display alert timestamp", () => {
      renderWithProviders(<AlertsPage />);
      
      // Should show relative or formatted timestamps
      const alertCard = screen.getByTestId("alert-item-alert-1");
      expect(within(alertCard).getByTestId("alert-timestamp-alert-1")).toBeInTheDocument();
    });
  });

  describe("AC3: Allow acknowledging alerts", () => {
    test("should have acknowledge button for unacknowledged alerts", () => {
      renderWithProviders(<AlertsPage />);
      
      // Should have acknowledge buttons
      const acknowledgeButtons = screen.getAllByRole("button", { name: /acknowledge/i });
      expect(acknowledgeButtons.length).toBeGreaterThan(0);
    });

    test("should show acknowledged status for acknowledged alerts", () => {
      renderWithProviders(<AlertsPage />);
      
      // Alert-3 and alert-5 are acknowledged - check that multiple "acknowledged" texts exist
      // (one in badge, one in timestamp)
      const acknowledgedAlert = screen.getByTestId("alert-item-alert-3");
      const acknowledgedTexts = within(acknowledgedAlert).getAllByText(/acknowledged/i);
      expect(acknowledgedTexts.length).toBeGreaterThan(0);
    });

    test("should not show acknowledge button for already acknowledged alerts", () => {
      renderWithProviders(<AlertsPage />);
      
      // Alert-3 is acknowledged, so it shouldn't have an acknowledge button
      const acknowledgedAlert = screen.getByTestId("alert-item-alert-3");
      expect(within(acknowledgedAlert).queryByRole("button", { name: /acknowledge/i })).not.toBeInTheDocument();
    });

    test("should call acknowledge mutation when button clicked", async () => {
      renderWithProviders(<AlertsPage />);
      
      const acknowledgeButtons = screen.getAllByRole("button", { name: /acknowledge/i });
      fireEvent.click(acknowledgeButtons[0]);
      
      await waitFor(() => {
        expect(mockAcknowledgeMutation).toHaveBeenCalled();
      });
    });
  });

  describe("AC4: Filter by type (budget, anomaly, recommendation) and status", () => {
    test("should have type filter", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("type-filter")).toBeInTheDocument();
    });

    test("should have status filter", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });

    test("should have filters section", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("filters-section")).toBeInTheDocument();
    });

    test("should have clear filters button", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByRole("button", { name: /clear.*filters/i })).toBeInTheDocument();
    });

    test("should display filter options for alert types", () => {
      renderWithProviders(<AlertsPage />);
      
      const typeFilter = screen.getByTestId("type-filter");
      expect(typeFilter).toBeInTheDocument();
    });

    test("should display filter options for status (acknowledged/unacknowledged)", () => {
      renderWithProviders(<AlertsPage />);
      
      const statusFilter = screen.getByTestId("status-filter");
      expect(statusFilter).toBeInTheDocument();
    });
  });

  describe("AC5: Show unacknowledged alert count in navigation", () => {
    test("should display unacknowledged count badge", () => {
      renderWithProviders(<AlertsPage />);
      
      // Should show count of unacknowledged alerts (3 in mock data: alert-1, alert-2, alert-4)
      expect(screen.getByTestId("unacknowledged-count")).toBeInTheDocument();
    });

    test("should show correct unacknowledged count", () => {
      renderWithProviders(<AlertsPage />);
      
      // 3 unacknowledged alerts in mock data
      const countBadge = screen.getByTestId("unacknowledged-count");
      expect(countBadge).toHaveTextContent("3");
    });
  });

  describe("Alert Display Features", () => {
    test("should sort alerts by triggered time (newest first)", () => {
      renderWithProviders(<AlertsPage />);
      
      const alertItems = screen.getAllByTestId(/alert-item-/);
      // Most recent should be first
      expect(alertItems[0]).toHaveAttribute("data-testid", "alert-item-alert-1");
    });

    test("should display severity icon or color indicator", () => {
      renderWithProviders(<AlertsPage />);
      
      // Critical alerts should have visual indicator
      const criticalAlert = screen.getByTestId("alert-item-alert-1");
      expect(within(criticalAlert).getByTestId("severity-indicator-alert-1")).toBeInTheDocument();
    });

    test("should have severity filter option", () => {
      renderWithProviders(<AlertsPage />);
      
      expect(screen.getByTestId("severity-filter")).toBeInTheDocument();
    });
  });
});

describe("AlertsPage Route Integration", () => {
  test("AlertsPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.AlertsPage).toBeDefined();
    expect(typeof pages.AlertsPage).toBe("function");
  });
});
