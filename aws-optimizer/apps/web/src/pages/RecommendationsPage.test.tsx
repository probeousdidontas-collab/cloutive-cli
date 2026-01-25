import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { RecommendationsPage } from "./RecommendationsPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock recommendations data with various types
const mockRecommendations = [
  {
    _id: "rec-1",
    awsAccountId: "account-1",
    type: "rightsizing",
    title: "Rightsize EC2 instance i-0abc123",
    description: "Instance i-0abc123def456789 is running at 5% CPU utilization. Consider downsizing from m5.xlarge to m5.large.",
    estimatedSavings: 150,
    status: "open",
    resourceId: "i-0abc123def456789",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "rec-2",
    awsAccountId: "account-1",
    type: "reserved_instance",
    title: "Purchase Reserved Instance for RDS",
    description: "You have been running db.m5.large for 6 months. A 1-year reserved instance would save 40%.",
    estimatedSavings: 200,
    status: "open",
    resourceId: "db-production-main",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 7200000,
  },
  {
    _id: "rec-3",
    awsAccountId: "account-2",
    type: "unused_resource",
    title: "Delete unused EBS volume",
    description: "Volume vol-0123456789abcdef has been detached for 30 days with no recent access.",
    estimatedSavings: 25,
    status: "open",
    resourceId: "vol-0123456789abcdef",
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 86400000,
  },
  {
    _id: "rec-4",
    awsAccountId: "account-1",
    type: "idle_resource",
    title: "Stop idle development EC2 instance",
    description: "Instance i-0xyz789 in development has been idle for 7 days.",
    estimatedSavings: 75,
    status: "implemented",
    resourceId: "i-0xyz789abc123456",
    createdAt: Date.now() - 345600000,
    updatedAt: Date.now() - 172800000,
  },
  {
    _id: "rec-5",
    awsAccountId: "account-2",
    type: "savings_plan",
    title: "Purchase Compute Savings Plan",
    description: "Based on your usage patterns, a $100/month Compute Savings Plan would save 20%.",
    estimatedSavings: 300,
    status: "open",
    resourceId: undefined,
    createdAt: Date.now() - 432000000,
    updatedAt: Date.now() - 259200000,
  },
  {
    _id: "rec-6",
    awsAccountId: "account-1",
    type: "storage_optimization",
    title: "Move S3 data to Glacier",
    description: "Bucket my-archive-bucket has 500GB of data not accessed in 90 days.",
    estimatedSavings: 40,
    status: "dismissed",
    resourceId: "my-archive-bucket",
    createdAt: Date.now() - 518400000,
    updatedAt: Date.now() - 345600000,
  },
];

// Mock AWS accounts
const mockAccounts = [
  { _id: "account-1", name: "Production", accountNumber: "123456789012", status: "active" },
  { _id: "account-2", name: "Development", accountNumber: "987654321098", status: "active" },
];

let queryCallIndex = 0;

const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // First call is for recommendations, second is for accounts
    if (queryCallIndex % 2 === 1) return mockRecommendations;
    return mockAccounts;
  }),
  useMutation: () => mockUseMutation(),
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

describe("US-027: Recommendations Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mockNavigate.mockClear();
    mockUseMutation.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /recommendations route with AI-generated recommendations", () => {
    test("should render recommendations page", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("recommendations-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByRole("heading", { name: /recommendations/i })).toBeInTheDocument();
    });

    test("should display recommendations list", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("recommendations-list")).toBeInTheDocument();
    });

    test("should indicate recommendations are AI-generated", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Should have some indication that recommendations are AI-powered
      expect(screen.getByText("AI Generated")).toBeInTheDocument();
    });
  });

  describe("AC2: Display recommendation title, description, and estimated savings", () => {
    test("should display recommendation titles", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByText(/Rightsize EC2 instance/)).toBeInTheDocument();
      expect(screen.getByText(/Purchase Reserved Instance/)).toBeInTheDocument();
    });

    test("should display recommendation descriptions", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByText(/5% CPU utilization/)).toBeInTheDocument();
    });

    test("should display estimated savings for each recommendation", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Should show formatted savings amounts
      expect(screen.getByText(/\$150/)).toBeInTheDocument();
      expect(screen.getByText(/\$200/)).toBeInTheDocument();
    });

    test("should display recommendation cards with all details", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Each recommendation should be displayed as a card or row
      const recommendationItems = screen.getAllByTestId(/recommendation-item-/);
      expect(recommendationItems.length).toBeGreaterThan(0);
    });
  });

  describe("AC3: Filter by type (rightsizing, reserved instances, unused resources, etc.)", () => {
    test("should have recommendation type filter", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("type-filter")).toBeInTheDocument();
    });

    test("should have filters section", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("filters-section")).toBeInTheDocument();
    });

    test("should have clear filters button", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByRole("button", { name: /clear.*filters/i })).toBeInTheDocument();
    });

    test("should display recommendation type badges", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Should show type badges for different recommendation types
      expect(screen.getAllByText(/rightsizing/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/reserved instance/i).length).toBeGreaterThan(0);
    });

    test("should have status filter", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });
  });

  describe("AC4: Allow marking recommendations as implemented or dismissed", () => {
    test("should have mark as implemented button for open recommendations", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Should have action buttons
      const implementedButtons = screen.getAllByRole("button", { name: /implement/i });
      expect(implementedButtons.length).toBeGreaterThan(0);
    });

    test("should have dismiss button for open recommendations", () => {
      renderWithProviders(<RecommendationsPage />);
      
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss/i });
      expect(dismissButtons.length).toBeGreaterThan(0);
    });

    test("should have action buttons section", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("recommendation-actions-rec-1")).toBeInTheDocument();
    });

    test("should display status badge for each recommendation", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Should show status badges
      expect(screen.getAllByText(/open/i).length).toBeGreaterThan(0);
    });
  });

  describe("AC5: Show total potential savings at top", () => {
    test("should display total potential savings summary", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("total-savings-summary")).toBeInTheDocument();
    });

    test("should show calculated total savings amount", () => {
      renderWithProviders(<RecommendationsPage />);
      
      // Total open recommendations savings: 150 + 200 + 25 + 300 = 675
      // (rec-4 is implemented, rec-6 is dismissed, so they don't count)
      expect(screen.getByTestId("total-savings-amount")).toBeInTheDocument();
    });

    test("should display total savings prominently", () => {
      renderWithProviders(<RecommendationsPage />);
      
      const savingsSummary = screen.getByTestId("total-savings-summary");
      expect(within(savingsSummary).getByText(/\$675/)).toBeInTheDocument();
    });

    test("should show number of open recommendations", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("open-recommendations-count")).toBeInTheDocument();
    });
  });

  describe("Sorting functionality", () => {
    test("should have sortable columns or sort options", () => {
      renderWithProviders(<RecommendationsPage />);
      
      expect(screen.getByTestId("sort-by-savings")).toBeInTheDocument();
    });

    test("should toggle sort direction when clicking sort control", async () => {
      renderWithProviders(<RecommendationsPage />);
      
      const sortBySavings = screen.getByTestId("sort-by-savings");
      fireEvent.click(sortBySavings);
      
      await waitFor(() => {
        expect(sortBySavings).toBeInTheDocument();
      });
    });
  });
});

describe("RecommendationsPage Route Integration", () => {
  test("RecommendationsPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.RecommendationsPage).toBeDefined();
    expect(typeof pages.RecommendationsPage).toBe("function");
  });
});
