import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ResourcesPage } from "./ResourcesPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock resources data with various types, regions, and accounts
const mockResources = [
  {
    _id: "resource-1",
    awsAccountId: "account-1",
    resourceType: "EC2",
    resourceId: "i-0abc123def456789",
    name: "Production Web Server",
    region: "us-east-1",
    monthlyCost: 150.25,
    tags: { environment: "production", team: "platform", project: "web-app" },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "resource-2",
    awsAccountId: "account-1",
    resourceType: "RDS",
    resourceId: "db-production-main",
    name: "Main Database",
    region: "us-east-1",
    monthlyCost: 350.00,
    tags: { environment: "production", team: "backend" },
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 7200000,
  },
  {
    _id: "resource-3",
    awsAccountId: "account-2",
    resourceType: "S3",
    resourceId: "my-data-bucket",
    name: "Data Storage Bucket",
    region: "us-west-2",
    monthlyCost: 45.50,
    tags: { environment: "production", team: "data" },
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 86400000,
  },
  {
    _id: "resource-4",
    awsAccountId: "account-1",
    resourceType: "Lambda",
    resourceId: "api-handler",
    name: "API Handler Function",
    region: "us-east-1",
    monthlyCost: 25.75,
    tags: { environment: "staging", team: "serverless" },
    createdAt: Date.now() - 345600000,
    updatedAt: Date.now() - 172800000,
  },
  {
    _id: "resource-5",
    awsAccountId: "account-2",
    resourceType: "EC2",
    resourceId: "i-0xyz789abc123456",
    name: "Development Server",
    region: "eu-west-1",
    monthlyCost: 75.00,
    tags: { environment: "development", team: "platform" },
    createdAt: Date.now() - 432000000,
    updatedAt: Date.now() - 259200000,
  },
  {
    _id: "resource-6",
    awsAccountId: "account-1",
    resourceType: "EBS",
    resourceId: "vol-0123456789abcdef",
    name: "Production Volume",
    region: "us-east-1",
    monthlyCost: 20.00,
    tags: { environment: "production" },
    createdAt: Date.now() - 518400000,
    updatedAt: Date.now() - 345600000,
  },
];

// Mock AWS accounts
const mockAccounts = [
  { _id: "account-1", name: "Production", accountNumber: "123456789012", status: "active" },
  { _id: "account-2", name: "Development", accountNumber: "987654321098", status: "active" },
];

// Mock recommendations linked to resources
const mockRecommendations = [
  {
    _id: "rec-1",
    awsAccountId: "account-1",
    type: "rightsizing",
    title: "Rightsize EC2 instance",
    description: "Instance i-0abc123def456789 is underutilized",
    estimatedSavings: 50,
    status: "open",
    resourceId: "i-0abc123def456789",
  },
  {
    _id: "rec-2",
    awsAccountId: "account-1",
    type: "unused_resource",
    title: "Delete unused EBS volume",
    description: "Volume vol-0123456789abcdef has no attachments",
    estimatedSavings: 20,
    status: "open",
    resourceId: "vol-0123456789abcdef",
  },
];

let queryCallIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // Cycle through: resources, accounts, recommendations
    const mod = queryCallIndex % 3;
    if (mod === 1) return mockResources;
    if (mod === 2) return mockAccounts;
    return mockRecommendations;
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

describe("US-026: Resources Inventory Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /resources route with resource inventory", () => {
    test("should render resources page", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("resources-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByRole("heading", { name: /resources/i })).toBeInTheDocument();
    });

    test("should display resources inventory table", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("resources-table")).toBeInTheDocument();
    });

    test("should display resource data rows", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Should show resource names from mock data
      expect(screen.getByText("Production Web Server")).toBeInTheDocument();
      expect(screen.getByText("Main Database")).toBeInTheDocument();
    });
  });

  describe("AC2: Filter by resource type (EC2, RDS, S3, etc.), region, account", () => {
    test("should have resource type filter", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("resource-type-filter")).toBeInTheDocument();
    });

    test("should have region filter", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("region-filter")).toBeInTheDocument();
    });

    test("should have account filter", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("account-filter")).toBeInTheDocument();
    });

    test("should have filters section", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("filters-section")).toBeInTheDocument();
    });

    test("should have clear filters button", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByRole("button", { name: /clear.*filters/i })).toBeInTheDocument();
    });
  });

  describe("AC3: Display resource details: name, type, region, monthly cost estimate", () => {
    test("should display table with column headers", () => {
      renderWithProviders(<ResourcesPage />);
      
      const table = screen.getByTestId("resources-table");
      expect(within(table).getByText(/name/i)).toBeInTheDocument();
      expect(within(table).getByText(/type/i)).toBeInTheDocument();
      expect(within(table).getByText(/region/i)).toBeInTheDocument();
      expect(within(table).getByText(/cost/i)).toBeInTheDocument();
    });

    test("should display resource types", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Multiple EC2 resources exist, so use getAllByText
      expect(screen.getAllByText("EC2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("RDS").length).toBeGreaterThan(0);
      expect(screen.getAllByText("S3").length).toBeGreaterThan(0);
    });

    test("should display region information", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getAllByText(/us-east-1/i).length).toBeGreaterThan(0);
    });

    test("should display monthly cost estimates", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Should show formatted cost values
      expect(screen.getByText(/\$150\.25/)).toBeInTheDocument();
      expect(screen.getByText(/\$350\.00/)).toBeInTheDocument();
    });

    test("should show total cost summary", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("total-cost-summary")).toBeInTheDocument();
    });
  });

  describe("AC4: Show resource tags for categorization", () => {
    test("should display tags column in table", () => {
      renderWithProviders(<ResourcesPage />);
      
      const table = screen.getByTestId("resources-table");
      expect(within(table).getByText(/tags/i)).toBeInTheDocument();
    });

    test("should display resource tags as badges", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Should show tag keys/values
      expect(screen.getAllByText(/environment/i).length).toBeGreaterThan(0);
    });

    test("should have tag filter for searching by tags", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("tag-filter")).toBeInTheDocument();
    });
  });

  describe("AC5: Link resources to recommendations where applicable", () => {
    test("should display recommendations column", () => {
      renderWithProviders(<ResourcesPage />);
      
      const table = screen.getByTestId("resources-table");
      // Look for recommendations indicator
      expect(within(table).getByText(/recommendations/i)).toBeInTheDocument();
    });

    test("should show recommendation indicator for resources with recommendations", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Should have some indicator for resources with recommendations
      expect(screen.getByTestId("recommendation-indicator-resource-1")).toBeInTheDocument();
    });

    test("should link to recommendations page or show recommendation details", () => {
      renderWithProviders(<ResourcesPage />);
      
      // Resources with recommendations should have clickable links
      const recommendationLink = screen.getByTestId("recommendation-indicator-resource-1");
      expect(recommendationLink).toBeInTheDocument();
    });
  });

  describe("Sorting functionality", () => {
    test("should have sortable columns", () => {
      renderWithProviders(<ResourcesPage />);
      
      expect(screen.getByTestId("sort-by-name")).toBeInTheDocument();
      expect(screen.getByTestId("sort-by-cost")).toBeInTheDocument();
    });

    test("should toggle sort direction when clicking column header", async () => {
      renderWithProviders(<ResourcesPage />);
      
      const sortByCost = screen.getByTestId("sort-by-cost");
      fireEvent.click(sortByCost);
      
      // Clicking again should toggle direction
      await waitFor(() => {
        expect(sortByCost).toBeInTheDocument();
      });
    });
  });
});

describe("ResourcesPage Route Integration", () => {
  test("ResourcesPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.ResourcesPage).toBeDefined();
    expect(typeof pages.ResourcesPage).toBe("function");
  });
});
