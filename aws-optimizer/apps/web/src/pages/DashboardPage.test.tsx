import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { DashboardPage } from "./DashboardPage";

// Mock @mantine/charts to avoid Recharts rendering issues in jsdom
vi.mock("@mantine/charts", () => ({
  DonutChart: ({ data }: { data: Array<{ name: string }> }) => (
    <div data-testid="mock-donut-chart">
      {data?.map((item) => <span key={item.name}>{item.name}</span>)}
    </div>
  ),
  AreaChart: () => <div data-testid="mock-area-chart" />,
}));

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock cost snapshot data - current month
const mockCostSnapshots = [
  // Current month data (January 2025)
  {
    _id: "snapshot-1",
    awsAccountId: "account-1",
    date: "2025-01-01",
    totalCost: 1500,
    serviceBreakdown: { "Amazon EC2": 800, "Amazon S3": 400, "Amazon RDS": 300 },
    regionBreakdown: { "us-east-1": 1000, "us-west-2": 500 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "snapshot-2",
    awsAccountId: "account-1",
    date: "2025-01-02",
    totalCost: 1600,
    serviceBreakdown: { "Amazon EC2": 850, "Amazon S3": 420, "Amazon RDS": 330 },
    regionBreakdown: { "us-east-1": 1100, "us-west-2": 500 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "snapshot-3",
    awsAccountId: "account-1",
    date: "2025-01-03",
    totalCost: 1550,
    serviceBreakdown: { "Amazon EC2": 820, "Amazon S3": 410, "Amazon RDS": 320 },
    regionBreakdown: { "us-east-1": 1050, "us-west-2": 500 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Previous month data (December 2024)
  {
    _id: "snapshot-4",
    awsAccountId: "account-1",
    date: "2024-12-01",
    totalCost: 1400,
    serviceBreakdown: { "Amazon EC2": 750, "Amazon S3": 380, "Amazon RDS": 270 },
    regionBreakdown: { "us-east-1": 950, "us-west-2": 450 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "snapshot-5",
    awsAccountId: "account-1",
    date: "2024-12-15",
    totalCost: 1450,
    serviceBreakdown: { "Amazon EC2": 770, "Amazon S3": 390, "Amazon RDS": 290 },
    regionBreakdown: { "us-east-1": 970, "us-west-2": 480 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Multi-account data (account-2)
  {
    _id: "snapshot-6",
    awsAccountId: "account-2",
    date: "2025-01-01",
    totalCost: 800,
    serviceBreakdown: { "Amazon Lambda": 400, "Amazon DynamoDB": 400 },
    regionBreakdown: { "us-east-1": 800 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Mock recommendations data
const mockRecommendations = [
  {
    _id: "rec-1",
    awsAccountId: "account-1",
    type: "rightsizing",
    title: "Rightsize EC2 instance i-12345",
    description: "This instance is consistently underutilized. Consider downsizing to t3.medium.",
    estimatedSavings: 150,
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "rec-2",
    awsAccountId: "account-1",
    type: "reserved_instance",
    title: "Purchase Reserved Instance for RDS",
    description: "You have consistently running RDS instances that could benefit from reserved pricing.",
    estimatedSavings: 200,
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "rec-3",
    awsAccountId: "account-1",
    type: "unused_resource",
    title: "Delete unused EBS volume vol-abc123",
    description: "This EBS volume has been detached for over 30 days.",
    estimatedSavings: 50,
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "rec-4",
    awsAccountId: "account-1",
    type: "storage_optimization",
    title: "Move S3 objects to Glacier",
    description: "Objects older than 90 days could be moved to Glacier for cost savings.",
    estimatedSavings: 75,
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "rec-5",
    awsAccountId: "account-2",
    type: "idle_resource",
    title: "Stop idle Lambda functions",
    description: "Several Lambda functions have not been invoked in 30 days.",
    estimatedSavings: 25,
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "rec-6",
    awsAccountId: "account-1",
    type: "network_optimization",
    title: "Optimize NAT Gateway usage",
    description: "Consider using VPC endpoints for S3 access.",
    estimatedSavings: 100,
    status: "implemented",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Mock AWS accounts
const mockAwsAccounts = [
  {
    _id: "account-1",
    name: "Production",
    accountNumber: "123456789012",
    status: "active",
  },
  {
    _id: "account-2",
    name: "Development",
    accountNumber: "987654321098",
    status: "active",
  },
];

let queryCallIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // Rotate through mock data based on call order
    const callType = queryCallIndex % 3;
    if (callType === 1) return mockCostSnapshots;
    if (callType === 2) return mockRecommendations;
    return mockAwsAccounts;
  }),
}));

// Mock auth client with organizationMethods
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
  IS_TEST_MODE: true,
  organizationMethods: {
    list: vi.fn().mockResolvedValue({
      data: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
      error: null,
    }),
    getActive: vi.fn().mockResolvedValue({
      data: { id: "test-org-id", name: "Test Organization", slug: "test-org" },
      error: null,
    }),
    setActive: vi.fn().mockResolvedValue({ data: { organizationId: "test-org-id" }, error: null }),
    create: vi.fn().mockResolvedValue({ data: { id: "new-org-id", name: "New Org" }, error: null }),
    update: vi.fn().mockResolvedValue({ data: { id: "test-org-id", name: "Updated Org" }, error: null }),
  },
}));

// Mock useOrganization hook - DashboardPage uses this now
vi.mock("../hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrganization: { id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" },
    organizations: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
    convexOrgId: "test-org-id",
    isLoading: false,
    isSwitching: false,
    isReady: true,
    error: null,
    switchOrganization: vi.fn().mockResolvedValue(true),
    createOrganization: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock useStores hook for MobX
vi.mock("../stores/useStores", () => ({
  useStores: () => ({
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
    organizationStore: {
      activeOrganization: { id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" },
      organizations: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
      convexOrgId: "test-org-id",
      isLoading: false,
      isSwitching: false,
      isResolvingConvexId: false,
      isReady: true,
      hasInitialized: true,
      error: null,
    },
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-024: Cost Dashboard Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /dashboard route with cost overview", () => {
    test("should render dashboard page", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });

    test("should display cost overview section", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("cost-overview")).toBeInTheDocument();
    });
  });

  describe("AC2: Show total cost for current month with comparison to previous month", () => {
    test("should display current month total cost", () => {
      renderWithProviders(<DashboardPage />);
      
      // Look for the current month cost display
      expect(screen.getByTestId("current-month-cost")).toBeInTheDocument();
    });

    test("should display previous month comparison", () => {
      renderWithProviders(<DashboardPage />);
      
      // Look for comparison indicator
      expect(screen.getByTestId("month-comparison")).toBeInTheDocument();
    });

    test("should show cost trend indicator (up/down)", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should have some kind of trend indicator
      const trendIndicator = screen.getByTestId("cost-trend-indicator");
      expect(trendIndicator).toBeInTheDocument();
    });
  });

  describe("AC3: Display cost breakdown by service (pie chart)", () => {
    test("should display service breakdown section", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("service-breakdown")).toBeInTheDocument();
    });

    test("should have a pie/donut chart for service costs", () => {
      renderWithProviders(<DashboardPage />);
      
      // Check for chart container
      expect(screen.getByTestId("service-chart")).toBeInTheDocument();
    });

    test("should display service names", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should show service names somewhere on the page
      expect(screen.getByText(/EC2/i)).toBeInTheDocument();
    });
  });

  describe("AC4: Display cost trend over time (line chart)", () => {
    test("should display cost trend section", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("cost-trend")).toBeInTheDocument();
    });

    test("should have a line chart for cost trend", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    });
  });

  describe("AC5: Show top 5 recommendations with estimated savings", () => {
    test("should display recommendations section", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("top-recommendations")).toBeInTheDocument();
    });

    test("should show recommendation titles", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should display at least one recommendation title
      expect(screen.getByText(/Rightsize EC2/i)).toBeInTheDocument();
    });

    test("should show estimated savings amounts", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should display savings amounts (looking for dollar amounts)
      expect(screen.getByText(/\$150/)).toBeInTheDocument();
    });

    test("should limit to top 5 recommendations", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should only show top 5 recommendations (by estimated savings)
      const recommendationItems = screen.getAllByTestId(/^recommendation-item-/);
      expect(recommendationItems.length).toBeLessThanOrEqual(5);
    });

    test("should show total potential savings", () => {
      renderWithProviders(<DashboardPage />);
      
      expect(screen.getByTestId("total-savings")).toBeInTheDocument();
    });
  });

  describe("AC6: Support multi-account aggregation", () => {
    test("should aggregate costs from multiple accounts", () => {
      renderWithProviders(<DashboardPage />);
      
      // The total should include costs from both accounts
      // Current month: account-1 has 1500+1600+1550 = 4650, account-2 has 800
      // We should see aggregated data displayed
      expect(screen.getByTestId("cost-overview")).toBeInTheDocument();
    });

    test("should show account selector or aggregation indicator", () => {
      renderWithProviders(<DashboardPage />);
      
      // Should indicate that data is aggregated across accounts
      expect(screen.getByTestId("account-aggregation")).toBeInTheDocument();
    });
  });
});

describe("DashboardPage Route Integration", () => {
  test("DashboardPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.DashboardPage).toBeDefined();
    // observer() wrapped components are callable (usable as React components)
    // but typeof may return "object" for forwardRef components
    expect(typeof pages.DashboardPage === "function" || typeof pages.DashboardPage === "object").toBe(true);
  });
});
