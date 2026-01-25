import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { CostExplorerPage } from "./CostExplorerPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock cost data with various services, regions, and accounts
const mockCostData = [
  {
    _id: "cost-1",
    awsAccountId: "account-1",
    date: "2025-01-15",
    service: "Amazon EC2",
    region: "us-east-1",
    cost: 150.25,
    tags: { environment: "production", team: "platform" },
  },
  {
    _id: "cost-2",
    awsAccountId: "account-1",
    date: "2025-01-15",
    service: "Amazon S3",
    region: "us-east-1",
    cost: 45.50,
    tags: { environment: "production", team: "data" },
  },
  {
    _id: "cost-3",
    awsAccountId: "account-1",
    date: "2025-01-14",
    service: "Amazon EC2",
    region: "us-west-2",
    cost: 120.00,
    tags: { environment: "staging", team: "platform" },
  },
  {
    _id: "cost-4",
    awsAccountId: "account-2",
    date: "2025-01-15",
    service: "Amazon RDS",
    region: "us-east-1",
    cost: 200.00,
    tags: { environment: "production", team: "backend" },
  },
  {
    _id: "cost-5",
    awsAccountId: "account-2",
    date: "2025-01-13",
    service: "Amazon Lambda",
    region: "eu-west-1",
    cost: 25.75,
    tags: { environment: "development", team: "serverless" },
  },
  {
    _id: "cost-6",
    awsAccountId: "account-1",
    date: "2025-01-12",
    service: "Amazon EC2",
    region: "us-east-1",
    cost: 155.00,
    tags: { environment: "production", team: "platform" },
  },
  {
    _id: "cost-7",
    awsAccountId: "account-1",
    date: "2025-01-10",
    service: "Amazon S3",
    region: "us-east-1",
    cost: 42.00,
    tags: { environment: "production", team: "data" },
  },
];

// Mock AWS accounts
const mockAccounts = [
  { _id: "account-1", name: "Production", accountNumber: "123456789012", status: "active" },
  { _id: "account-2", name: "Development", accountNumber: "987654321098", status: "active" },
];

let queryCallIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // First call is for cost data, second is for accounts
    if (queryCallIndex % 2 === 1) return mockCostData;
    return mockAccounts;
  }),
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

describe("US-025: Cost Explorer Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /costs route with filterable cost data", () => {
    test("should render cost explorer page", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("cost-explorer-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByRole("heading", { name: /cost explorer/i })).toBeInTheDocument();
    });

    test("should display filters section", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("filters-section")).toBeInTheDocument();
    });

    test("should display cost data in the table", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("costs-table")).toBeInTheDocument();
    });
  });

  describe("AC2: Filter by date range, service, region, account, tags", () => {
    test("should have date range filter", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("date-range-filter")).toBeInTheDocument();
    });

    test("should have service filter", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("service-filter")).toBeInTheDocument();
    });

    test("should have region filter", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("region-filter")).toBeInTheDocument();
    });

    test("should have account filter", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("account-filter")).toBeInTheDocument();
    });

    test("should have tag filter", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("tag-filter")).toBeInTheDocument();
    });

    test("should have clear filters button", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByRole("button", { name: /clear.*filters/i })).toBeInTheDocument();
    });
  });

  describe("AC3: Display costs in table format with sorting", () => {
    test("should display table with column headers", () => {
      renderWithProviders(<CostExplorerPage />);
      
      const table = screen.getByTestId("costs-table");
      expect(within(table).getByText(/date/i)).toBeInTheDocument();
      expect(within(table).getByText(/service/i)).toBeInTheDocument();
      expect(within(table).getByText(/region/i)).toBeInTheDocument();
      expect(within(table).getByText(/cost/i)).toBeInTheDocument();
    });

    test("should display cost data rows", () => {
      renderWithProviders(<CostExplorerPage />);
      
      // Should show service names from mock data
      expect(screen.getByText(/Amazon EC2/)).toBeInTheDocument();
      expect(screen.getByText(/Amazon S3/)).toBeInTheDocument();
    });

    test("should have sortable columns", () => {
      renderWithProviders(<CostExplorerPage />);
      
      // Check for sort indicators/buttons
      expect(screen.getByTestId("sort-by-date")).toBeInTheDocument();
      expect(screen.getByTestId("sort-by-cost")).toBeInTheDocument();
    });

    test("should show total cost summary", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("total-cost-summary")).toBeInTheDocument();
    });
  });

  describe("AC4: Show daily/weekly/monthly views", () => {
    test("should have view toggle for daily/weekly/monthly", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("view-toggle")).toBeInTheDocument();
    });

    test("should have daily view option", () => {
      renderWithProviders(<CostExplorerPage />);
      
      // SegmentedControl uses radio inputs
      expect(screen.getByRole("radio", { name: /daily/i })).toBeInTheDocument();
    });

    test("should have weekly view option", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByRole("radio", { name: /weekly/i })).toBeInTheDocument();
    });

    test("should have monthly view option", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByRole("radio", { name: /monthly/i })).toBeInTheDocument();
    });

    test("should change view when toggle clicked", async () => {
      renderWithProviders(<CostExplorerPage />);
      
      const weeklyRadio = screen.getByRole("radio", { name: /weekly/i });
      fireEvent.click(weeklyRadio);
      
      await waitFor(() => {
        // Weekly radio should be checked
        expect(weeklyRadio).toBeChecked();
      });
    });
  });

  describe("AC5: Allow CSV export of filtered data", () => {
    test("should have export to CSV button", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByRole("button", { name: /export.*csv/i })).toBeInTheDocument();
    });

    test("should have export icon", () => {
      renderWithProviders(<CostExplorerPage />);
      
      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });
  });
});

describe("CostExplorerPage Route Integration", () => {
  test("CostExplorerPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.CostExplorerPage).toBeDefined();
    expect(typeof pages.CostExplorerPage).toBe("function");
  });
});
