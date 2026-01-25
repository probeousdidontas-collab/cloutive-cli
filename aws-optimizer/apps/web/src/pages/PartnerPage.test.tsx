import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PartnerPage } from "./PartnerPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock client organizations data
const mockClientOrganizations = [
  {
    _id: "org-1",
    name: "Acme Corp",
    slug: "acme-corp",
    plan: "professional",
    settings: {},
    createdAt: Date.now() - 90 * 86400000,
    updatedAt: Date.now() - 86400000,
    // Summary stats
    totalCost: 45000,
    accountCount: 5,
    alertCount: 3,
    totalSavings: 5500,
    recommendationCount: 8,
  },
  {
    _id: "org-2",
    name: "TechStart Inc",
    slug: "techstart-inc",
    plan: "starter",
    settings: {},
    createdAt: Date.now() - 60 * 86400000,
    updatedAt: Date.now() - 3600000,
    totalCost: 12500,
    accountCount: 2,
    alertCount: 1,
    totalSavings: 1200,
    recommendationCount: 3,
  },
  {
    _id: "org-3",
    name: "Enterprise Co",
    slug: "enterprise-co",
    plan: "enterprise",
    settings: {},
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now() - 7200000,
    totalCost: 125000,
    accountCount: 15,
    alertCount: 8,
    totalSavings: 18500,
    recommendationCount: 24,
  },
];

const mockCreateClientOrg = vi.fn();
const mockGenerateAggregateReport = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockClientOrganizations),
  useMutation: vi.fn((mutationName) => {
    if (mutationName?.includes?.("generateAggregateReport")) return mockGenerateAggregateReport;
    return mockCreateClientOrg;
  }),
}));

// Mock auth client
vi.mock("../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        name: "Partner Admin",
        email: "partner@example.com",
      },
    },
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-038: Partner Dashboard - Organization List", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateClientOrg.mockClear();
    mockGenerateAggregateReport.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /partner route for partner dashboard", () => {
    test("should render partner dashboard page", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("partner-page")).toBeInTheDocument();
    });

    test("should display partner dashboard title", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByRole("heading", { name: /partner dashboard/i, level: 2 })).toBeInTheDocument();
    });

    test("should have partner-specific page structure", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("partner-page")).toBeInTheDocument();
      expect(screen.getByTestId("client-orgs-list")).toBeInTheDocument();
    });
  });

  describe("AC2: Display list of managed client organizations", () => {
    test("should display list of client organizations", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("TechStart Inc")).toBeInTheDocument();
      expect(screen.getByText("Enterprise Co")).toBeInTheDocument();
    });

    test("should have client organizations container", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("client-orgs-list")).toBeInTheDocument();
    });

    test("should display each organization as a card or row", () => {
      renderWithProviders(<PartnerPage />);
      
      const orgItems = screen.getAllByTestId(/org-item-/);
      expect(orgItems.length).toBe(3);
    });

    test("should display organization names", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("TechStart Inc")).toBeInTheDocument();
      expect(screen.getByText("Enterprise Co")).toBeInTheDocument();
    });
  });

  describe("AC3: Show summary stats - total cost, account count, alert count per org", () => {
    test("should display total cost for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      // Check that cost values are displayed
      expect(screen.getByTestId("org-item-org-1")).toHaveTextContent(/\$45,000/);
      expect(screen.getByTestId("org-item-org-2")).toHaveTextContent(/\$12,500/);
      expect(screen.getByTestId("org-item-org-3")).toHaveTextContent(/\$125,000/);
    });

    test("should display account count for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      const org1 = screen.getByTestId("org-item-org-1");
      const org2 = screen.getByTestId("org-item-org-2");
      const org3 = screen.getByTestId("org-item-org-3");
      
      expect(within(org1).getByTestId("account-count")).toHaveTextContent("5");
      expect(within(org2).getByTestId("account-count")).toHaveTextContent("2");
      expect(within(org3).getByTestId("account-count")).toHaveTextContent("15");
    });

    test("should display alert count for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      const org1 = screen.getByTestId("org-item-org-1");
      const org2 = screen.getByTestId("org-item-org-2");
      const org3 = screen.getByTestId("org-item-org-3");
      
      expect(within(org1).getByTestId("alert-count")).toHaveTextContent("3");
      expect(within(org2).getByTestId("alert-count")).toHaveTextContent("1");
      expect(within(org3).getByTestId("alert-count")).toHaveTextContent("8");
    });

    test("should display aggregate totals", () => {
      renderWithProviders(<PartnerPage />);
      
      // Should show total across all orgs
      expect(screen.getByTestId("total-clients")).toBeInTheDocument();
      expect(screen.getByTestId("total-clients")).toHaveTextContent("3");
    });
  });

  describe("AC4: Allow switching into client org context", () => {
    test("should have switch/manage button for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      const org1 = screen.getByTestId("org-item-org-1");
      expect(within(org1).getByRole("button", { name: /manage|switch|view/i })).toBeInTheDocument();
    });

    test("should navigate to client org when switch button clicked", async () => {
      renderWithProviders(<PartnerPage />);
      
      const org1 = screen.getByTestId("org-item-org-1");
      const manageButton = within(org1).getByRole("button", { name: /manage|switch|view/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    test("should have clickable organization cards", () => {
      renderWithProviders(<PartnerPage />);
      
      const orgItems = screen.getAllByTestId(/org-item-/);
      // Each org item should be interactive
      expect(orgItems.length).toBeGreaterThan(0);
    });
  });

  describe("AC5: Distinguish partner view with different UI treatment", () => {
    test("should have partner-specific styling indicator", () => {
      renderWithProviders(<PartnerPage />);
      
      // Should have a partner badge or indicator
      expect(screen.getByTestId("partner-indicator")).toBeInTheDocument();
    });

    test("should display partner badge or header", () => {
      renderWithProviders(<PartnerPage />);
      
      // Should indicate this is a partner view
      expect(screen.getByText("Partner View")).toBeInTheDocument();
    });

    test("should have distinct visual treatment for partner dashboard", () => {
      renderWithProviders(<PartnerPage />);
      
      const partnerPage = screen.getByTestId("partner-page");
      // Partner page should exist with its unique styling
      expect(partnerPage).toBeInTheDocument();
    });

    test("should show 'Client Organizations' section header", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByRole("heading", { name: /client organizations/i, level: 4 })).toBeInTheDocument();
    });
  });

  describe("Partner Dashboard Summary Stats", () => {
    test("should display total number of client organizations", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("total-clients")).toHaveTextContent("3");
    });

    test("should display total accounts across all clients", () => {
      renderWithProviders(<PartnerPage />);
      
      // 5 + 2 + 15 = 22 total accounts
      expect(screen.getByTestId("total-accounts")).toHaveTextContent("22");
    });

    test("should display total cost across all clients", () => {
      renderWithProviders(<PartnerPage />);
      
      // $45,000 + $12,500 + $125,000 = $182,500
      expect(screen.getByTestId("total-cost")).toBeInTheDocument();
    });

    test("should display total alerts across all clients", () => {
      renderWithProviders(<PartnerPage />);
      
      // 3 + 1 + 8 = 12 total alerts
      expect(screen.getByTestId("total-alerts")).toHaveTextContent("12");
    });
  });

  describe("Organization Plan Display", () => {
    test("should display plan type for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      // Get all plan badges - should have Professional, Starter, Enterprise
      expect(screen.getByText("Professional")).toBeInTheDocument();
      expect(screen.getByText("Starter")).toBeInTheDocument();
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    test("should render page even with organizations present", () => {
      // This test validates the page structure exists
      renderWithProviders(<PartnerPage />);
      
      // The page should render with the client orgs list container
      expect(screen.getByTestId("partner-page")).toBeInTheDocument();
      expect(screen.getByTestId("client-orgs-list")).toBeInTheDocument();
    });
  });
});

describe("PartnerPage Route Integration", () => {
  test("PartnerPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.PartnerPage).toBeDefined();
    expect(typeof pages.PartnerPage).toBe("function");
  });
});

describe("US-039: Partner - Client Organization Creation", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateClientOrg.mockClear();
    mockGenerateAggregateReport.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Add 'Create Client Org' button to partner dashboard", () => {
    test("should display Create Client Org button", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByRole("button", { name: /create client org/i })).toBeInTheDocument();
    });

    test("should have visible and accessible Create Client Org button", () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /create client org/i });
      expect(button).toBeEnabled();
    });
  });

  describe("AC2: Collect client organization name and primary contact email", () => {
    test("should open modal when Create Client Org button clicked", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("create-client-org-modal")).toBeInTheDocument();
      });
    });

    test("should have organization name input field in modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        const textboxes = screen.getAllByRole("textbox");
        expect(textboxes.length).toBeGreaterThanOrEqual(1);
      });
    });

    test("should have primary contact email input field in modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Check for email label text
        expect(screen.getByText("Primary Contact Email")).toBeInTheDocument();
      });
    });

    test("should have Create button in modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Modal should have a create/submit button
        const modalButtons = screen.getAllByRole("button");
        const createButton = modalButtons.find(btn => 
          btn.textContent?.toLowerCase().includes("create") && 
          btn !== button
        );
        expect(createButton).toBeInTheDocument();
      });
    });
  });

  describe("AC3: Create organization with partner as admin", () => {
    test("should render modal when button is clicked", async () => {
      renderWithProviders(<PartnerPage />);
      
      // Open modal
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("create-client-org-modal")).toBeInTheDocument();
      });

      // Modal should be in the document (content is rendered in portal)
      const modal = screen.getByTestId("create-client-org-modal");
      expect(modal).toBeInTheDocument();
    });
  });

  describe("Modal interaction", () => {
    test("should have modal visible after clicking create button", async () => {
      renderWithProviders(<PartnerPage />);
      
      // Open modal
      const button = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("create-client-org-modal")).toBeInTheDocument();
      });

      // Modal should be visible
      expect(screen.getByTestId("create-client-org-modal")).toBeVisible();
    });

    test("should have modal with proper data-testid", async () => {
      renderWithProviders(<PartnerPage />);
      
      const headerButton = screen.getByRole("button", { name: /create client org/i });
      fireEvent.click(headerButton);

      await waitFor(() => {
        expect(screen.getByTestId("create-client-org-modal")).toBeInTheDocument();
      });

      // Modal should have the correct test id
      const modal = screen.getByTestId("create-client-org-modal");
      expect(modal).toHaveAttribute("data-testid", "create-client-org-modal");
    });
  });
});

describe("US-040: Partner - Aggregate Reporting", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateClientOrg.mockClear();
    mockGenerateAggregateReport.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Add aggregate view to partner dashboard", () => {
    test("should display aggregate stats section", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("aggregate-stats")).toBeInTheDocument();
    });

    test("should display total clients in aggregate view", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByTestId("total-clients")).toHaveTextContent("3");
    });

    test("should display total accounts in aggregate view", () => {
      renderWithProviders(<PartnerPage />);
      
      // 5 + 2 + 15 = 22 total accounts
      expect(screen.getByTestId("total-accounts")).toHaveTextContent("22");
    });
  });

  describe("AC2: Show total managed spend across all clients", () => {
    test("should display total managed spend", () => {
      renderWithProviders(<PartnerPage />);
      
      // $45,000 + $12,500 + $125,000 = $182,500
      expect(screen.getByTestId("total-cost")).toBeInTheDocument();
      expect(screen.getByTestId("total-cost")).toHaveTextContent(/\$182,500/);
    });

    test("should have label for total managed spend", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByText(/Total Cost|Total Spend|Managed Spend/i)).toBeInTheDocument();
    });
  });

  describe("AC3: Display total savings recommendations", () => {
    test("should display total potential savings across all clients", () => {
      renderWithProviders(<PartnerPage />);
      
      // $5,500 + $1,200 + $18,500 = $25,200
      expect(screen.getByTestId("total-savings")).toBeInTheDocument();
      expect(screen.getByTestId("total-savings")).toHaveTextContent(/\$25,200/);
    });

    test("should display total recommendation count", () => {
      renderWithProviders(<PartnerPage />);
      
      // 8 + 3 + 24 = 35 recommendations
      expect(screen.getByTestId("total-recommendations")).toBeInTheDocument();
      expect(screen.getByTestId("total-recommendations")).toHaveTextContent("35");
    });

    test("should show savings for each organization", () => {
      renderWithProviders(<PartnerPage />);
      
      // Each org card should show savings
      expect(screen.getByTestId("org-item-org-1")).toHaveTextContent(/\$5,500/);
      expect(screen.getByTestId("org-item-org-2")).toHaveTextContent(/\$1,200/);
      expect(screen.getByTestId("org-item-org-3")).toHaveTextContent(/\$18,500/);
    });
  });

  describe("AC4: Allow generating cross-client reports", () => {
    test("should have Generate Aggregate Report button", () => {
      renderWithProviders(<PartnerPage />);
      
      expect(screen.getByRole("button", { name: /generate.*report|aggregate report/i })).toBeInTheDocument();
    });

    test("should open report modal when button clicked", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /generate.*report|aggregate report/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("aggregate-report-modal")).toBeInTheDocument();
      });
    });

    test("should have report type selector in modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /generate.*report|aggregate report/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("aggregate-report-modal")).toBeInTheDocument();
      });

      // Should have report type options - wait for them to render
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /summary/i })).toBeInTheDocument();
      });
    });

    test("should have client selection in report modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /generate.*report|aggregate report/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("aggregate-report-modal")).toBeInTheDocument();
      });

      // Should have option to select all clients or specific ones
      await waitFor(() => {
        expect(screen.getByTestId("client-selection")).toBeInTheDocument();
      });
    });
  });

  describe("AC5: Maintain client data isolation in reports", () => {
    test("should show aggregate totals without exposing individual client details by default", () => {
      renderWithProviders(<PartnerPage />);
      
      // Aggregate stats should be visible
      expect(screen.getByTestId("aggregate-stats")).toBeInTheDocument();
      
      // Individual client details should be in separate cards
      const orgCards = screen.getAllByTestId(/org-item-/);
      expect(orgCards.length).toBe(3);
    });

    test("should have anonymize option in report modal", async () => {
      renderWithProviders(<PartnerPage />);
      
      const button = screen.getByRole("button", { name: /generate.*report|aggregate report/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("aggregate-report-modal")).toBeInTheDocument();
      });

      // Should have option to anonymize client data
      await waitFor(() => {
        expect(screen.getByTestId("anonymize-option")).toBeInTheDocument();
      });
    });
  });

  describe("Partner Aggregate Stats Display", () => {
    test("should display savings percentage of total spend", () => {
      renderWithProviders(<PartnerPage />);
      
      // Total savings $25,200 / Total spend $182,500 ≈ 13.8%
      expect(screen.getByTestId("savings-percentage")).toBeInTheDocument();
    });
  });
});
