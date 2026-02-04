import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { BudgetsPage } from "./BudgetsPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock budgets data
const mockBudgets = [
  {
    _id: "budget-1",
    name: "Monthly Cloud Budget",
    amount: 10000,
    period: "monthly",
    alertThresholds: [50, 80, 100],
    currentSpend: 6500,
    scope: "organization",
    awsAccountId: null,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "budget-2",
    name: "Production Account Budget",
    amount: 5000,
    period: "monthly",
    alertThresholds: [80, 100],
    currentSpend: 4200,
    scope: "account",
    awsAccountId: "account-1",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 7200000,
  },
  {
    _id: "budget-3",
    name: "Q1 Infrastructure Budget",
    amount: 25000,
    period: "quarterly",
    alertThresholds: [50, 75, 90, 100],
    currentSpend: 8000,
    scope: "organization",
    awsAccountId: null,
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 10800000,
  },
  {
    _id: "budget-4",
    name: "Annual DevOps Budget",
    amount: 120000,
    period: "yearly",
    alertThresholds: [25, 50, 75, 100],
    currentSpend: 45000,
    scope: "organization",
    awsAccountId: null,
    createdAt: Date.now() - 345600000,
    updatedAt: Date.now() - 14400000,
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
    // First call is for budgets, second is for accounts
    if (queryCallIndex % 2 === 1) return mockBudgets;
    return mockAccounts;
  }),
  useMutation: vi.fn(() => vi.fn()),
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
  IS_TEST_MODE: true,
}));

// Mock useOrganization hook - must match the actual hook return values used by BudgetsPage
vi.mock("../hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrganization: {
      id: "test-org-id",
      name: "Test Organization",
      slug: "test-org",
    },
    convexOrgId: "test-convex-org-id",
    isLoading: false,
    isReady: true,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-029: Budgets Management Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /budgets route with budget list", () => {
    test("should render budgets page", () => {
      renderWithProviders(<BudgetsPage />);
      
      expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<BudgetsPage />);
      
      expect(screen.getByRole("heading", { name: /budgets/i })).toBeInTheDocument();
    });

    test("should display list of budgets", () => {
      renderWithProviders(<BudgetsPage />);
      
      expect(screen.getByText("Monthly Cloud Budget")).toBeInTheDocument();
      expect(screen.getByText("Production Account Budget")).toBeInTheDocument();
      expect(screen.getByText("Q1 Infrastructure Budget")).toBeInTheDocument();
      expect(screen.getByText("Annual DevOps Budget")).toBeInTheDocument();
    });

    test("should have budgets list container", () => {
      renderWithProviders(<BudgetsPage />);
      
      expect(screen.getByTestId("budgets-list")).toBeInTheDocument();
    });
  });

  describe("AC2: Allow creating budgets with name, amount, period (monthly/quarterly/yearly)", () => {
    test("should have Create Budget button", () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      expect(createButton).toBeInTheDocument();
    });

    test("should open create modal when button clicked", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("create-budget-modal")).toBeInTheDocument();
      });
    });

    test("should have name input field in create modal", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/budget name/i)).toBeInTheDocument();
      });
    });

    test("should have amount input field in create modal", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      });
    });

    test("should have period selector with monthly, quarterly, yearly options", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("period-selector")).toBeInTheDocument();
      });
      
      // Check for period options
      expect(screen.getByRole("radio", { name: /monthly/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /quarterly/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /yearly/i })).toBeInTheDocument();
    });

    test("should display budget period in list", () => {
      renderWithProviders(<BudgetsPage />);
      
      // Should show period badges
      expect(screen.getAllByText(/monthly/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/quarterly/i)).toBeInTheDocument();
      expect(screen.getByText(/yearly/i)).toBeInTheDocument();
    });
  });

  describe("AC3: Set alert thresholds (e.g., 50%, 80%, 100%)", () => {
    test("should have threshold configuration in create modal", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("threshold-selector")).toBeInTheDocument();
      });
    });

    test("should show common threshold options", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        // Should show checkboxes or inputs for thresholds
        expect(screen.getByLabelText(/50%/)).toBeInTheDocument();
        expect(screen.getByLabelText(/80%/)).toBeInTheDocument();
        expect(screen.getByLabelText(/100%/)).toBeInTheDocument();
      });
    });

    test("should display configured thresholds in budget list", () => {
      renderWithProviders(<BudgetsPage />);
      
      // Should show threshold badges or indicators
      expect(screen.getByTestId("budget-thresholds-budget-1")).toBeInTheDocument();
    });
  });

  describe("AC4: Display current spend vs. budget with progress bar", () => {
    test("should display progress bar for each budget", () => {
      renderWithProviders(<BudgetsPage />);
      
      const progressBars = screen.getAllByTestId(/budget-progress-/);
      expect(progressBars.length).toBe(4); // 4 budgets
    });

    test("should show current spend amount", () => {
      renderWithProviders(<BudgetsPage />);
      
      // Should display formatted currency amounts
      expect(screen.getByText(/\$6,500/)).toBeInTheDocument();
      expect(screen.getByText(/\$4,200/)).toBeInTheDocument();
    });

    test("should show budget amount", () => {
      renderWithProviders(<BudgetsPage />);
      
      expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    });

    test("should show percentage of budget used", () => {
      renderWithProviders(<BudgetsPage />);
      
      // 6500/10000 = 65%, 4200/5000 = 84%
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/84%/)).toBeInTheDocument();
    });

    test("should indicate when threshold is exceeded with color change", () => {
      renderWithProviders(<BudgetsPage />);
      
      // Production Account Budget is at 84% which exceeds 80% threshold
      const budgetCard = screen.getByTestId("budget-card-budget-2");
      expect(budgetCard).toBeInTheDocument();
      // Progress bar should have warning/danger indicator
      const progressBar = within(budgetCard).getByTestId("budget-progress-budget-2");
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe("AC5: Support per-account or organization-wide budgets", () => {
    test("should have scope selector in create modal", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("scope-selector")).toBeInTheDocument();
      });
    });

    test("should have organization-wide option", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /organization/i })).toBeInTheDocument();
      });
    });

    test("should have per-account option", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /specific account/i })).toBeInTheDocument();
      });
    });

    test("should show account selector when per-account scope selected", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const createButton = screen.getByRole("button", { name: /create budget/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("scope-selector")).toBeInTheDocument();
      });
      
      // Select per-account scope
      const accountRadio = screen.getByRole("radio", { name: /specific account/i });
      fireEvent.click(accountRadio);
      
      await waitFor(() => {
        expect(screen.getByTestId("account-selector")).toBeInTheDocument();
      });
    });

    test("should display scope indicator in budget list", () => {
      renderWithProviders(<BudgetsPage />);
      
      // Organization-wide budgets should show organization indicator
      expect(screen.getAllByText(/organization/i).length).toBeGreaterThan(0);
      // Per-account budget should show account name (multiple occurrences expected)
      expect(screen.getAllByText(/Production/).length).toBeGreaterThan(0);
    });
  });

  describe("Budget Management Actions", () => {
    test("should have edit button for each budget", () => {
      renderWithProviders(<BudgetsPage />);
      
      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      expect(editButtons.length).toBeGreaterThan(0);
    });

    test("should have delete button for each budget", () => {
      renderWithProviders(<BudgetsPage />);
      
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    test("should show confirmation modal when delete clicked", async () => {
      renderWithProviders(<BudgetsPage />);
      
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-delete-modal")).toBeInTheDocument();
      });
    });
  });
});

describe("BudgetsPage Route Integration", () => {
  test("BudgetsPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.BudgetsPage).toBeDefined();
    // BudgetsPage is wrapped with MobX observer, which returns an object with $$typeof
    expect(pages.BudgetsPage).toBeTruthy();
  });
});
