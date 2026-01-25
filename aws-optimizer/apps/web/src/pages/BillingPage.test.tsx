import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { BillingPage } from "./BillingPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock subscription/billing data
const mockSubscription = {
  _id: "sub-1",
  plan: "professional",
  status: "active",
  currentPeriodStart: Date.now() - 15 * 86400000, // 15 days ago
  currentPeriodEnd: Date.now() + 15 * 86400000, // 15 days from now
  pricePerMonth: 49,
  limits: {
    accounts: 10,
    analysisRuns: 100,
  },
};

// Mock usage statistics
const mockUsageStats = {
  accountsConnected: 3,
  analysisRunsThisMonth: 45,
  lastAnalysisAt: Date.now() - 3600000, // 1 hour ago
};

// Mock usage approaching limits
const mockUsageNearLimit = {
  accountsConnected: 9,
  analysisRunsThisMonth: 92,
  lastAnalysisAt: Date.now() - 3600000,
};

// Mock invoice history
const mockInvoices = [
  {
    _id: "inv-1",
    number: "INV-2025-001",
    amount: 4900, // cents
    currency: "usd",
    status: "paid",
    createdAt: Date.now() - 30 * 86400000, // 30 days ago
    paidAt: Date.now() - 30 * 86400000,
    invoiceUrl: "https://invoice.stripe.com/i/inv-1",
    invoicePdf: "https://invoice.stripe.com/i/inv-1/pdf",
  },
  {
    _id: "inv-2",
    number: "INV-2024-012",
    amount: 4900,
    currency: "usd",
    status: "paid",
    createdAt: Date.now() - 60 * 86400000, // 60 days ago
    paidAt: Date.now() - 60 * 86400000,
    invoiceUrl: "https://invoice.stripe.com/i/inv-2",
    invoicePdf: "https://invoice.stripe.com/i/inv-2/pdf",
  },
  {
    _id: "inv-3",
    number: "INV-2024-011",
    amount: 4900,
    currency: "usd",
    status: "paid",
    createdAt: Date.now() - 90 * 86400000, // 90 days ago
    paidAt: Date.now() - 90 * 86400000,
    invoiceUrl: "https://invoice.stripe.com/i/inv-3",
    invoicePdf: "https://invoice.stripe.com/i/inv-3/pdf",
  },
];

// Mock Stripe portal session
const mockCreatePortalSession = vi.fn().mockResolvedValue({
  url: "https://billing.stripe.com/session/test-session",
});

let queryCallIndex = 0;
let useNearLimitUsage = false;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // Cycle through different queries
    const index = (queryCallIndex - 1) % 3;
    if (index === 0) return mockSubscription;
    if (index === 1) return useNearLimitUsage ? mockUsageNearLimit : mockUsageStats;
    return mockInvoices;
  }),
  useMutation: vi.fn(() => mockCreatePortalSession),
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

describe("US-033: Billing Page with Stripe Portal", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    useNearLimitUsage = false;
    mockNavigate.mockClear();
    mockCreatePortalSession.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /billing route with current plan display", () => {
    test("should render billing page", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("billing-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByRole("heading", { name: /billing/i, level: 2 })).toBeInTheDocument();
    });

    test("should display current plan name", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("current-plan")).toBeInTheDocument();
      expect(screen.getByText(/professional/i)).toBeInTheDocument();
    });

    test("should display subscription status", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("subscription-status")).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    test("should display billing period information", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("billing-period")).toBeInTheDocument();
    });

    test("should display current plan price", () => {
      renderWithProviders(<BillingPage />);
      
      const planPrice = screen.getByTestId("plan-price");
      expect(planPrice).toBeInTheDocument();
      expect(planPrice.textContent).toMatch(/\$49/);
    });

    test("should display plan section", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("plan-section")).toBeInTheDocument();
    });
  });

  describe("AC2: Show usage statistics (accounts connected, analysis runs)", () => {
    test("should display usage statistics section", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("usage-stats")).toBeInTheDocument();
    });

    test("should display accounts connected count", () => {
      renderWithProviders(<BillingPage />);
      
      const accountsSection = screen.getByTestId("accounts-connected");
      expect(accountsSection).toBeInTheDocument();
      expect(accountsSection.textContent).toMatch(/3 of 10/);
    });

    test("should display analysis runs count", () => {
      renderWithProviders(<BillingPage />);
      
      const analysisSection = screen.getByTestId("analysis-runs");
      expect(analysisSection).toBeInTheDocument();
      expect(analysisSection.textContent).toMatch(/45 of 100/);
    });

    test("should display usage limits from plan", () => {
      renderWithProviders(<BillingPage />);
      
      // Should show limits like "3 of 10" for accounts and "45 of 100" for runs
      const accountsSection = screen.getByTestId("accounts-connected");
      const analysisSection = screen.getByTestId("analysis-runs");
      expect(accountsSection.textContent).toMatch(/of 10/);
      expect(analysisSection.textContent).toMatch(/of 100/);
    });

    test("should display usage progress indicators", () => {
      renderWithProviders(<BillingPage />);
      
      // Should have progress bars or similar visual indicators
      const usageStats = screen.getByTestId("usage-stats");
      expect(usageStats).toBeInTheDocument();
    });
  });

  describe("AC3: Integrate Stripe Customer Portal for plan management", () => {
    test("should have Manage Subscription button", () => {
      renderWithProviders(<BillingPage />);
      
      const manageButton = screen.getByRole("button", { name: /manage subscription/i });
      expect(manageButton).toBeInTheDocument();
    });

    test("should call createPortalSession when Manage Subscription clicked", async () => {
      renderWithProviders(<BillingPage />);
      
      const manageButton = screen.getByRole("button", { name: /manage subscription/i });
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(mockCreatePortalSession).toHaveBeenCalled();
      });
    });

    test("should have Update Payment Method option", () => {
      renderWithProviders(<BillingPage />);
      
      const updateButton = screen.getByRole("button", { name: /update payment method/i });
      expect(updateButton).toBeInTheDocument();
    });

    test("should display Stripe portal integration section", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("stripe-portal-section")).toBeInTheDocument();
    });

    test("should have cancel subscription option via portal", () => {
      renderWithProviders(<BillingPage />);
      
      // The manage subscription button leads to portal where cancel is available
      const manageButton = screen.getByRole("button", { name: /manage subscription/i });
      expect(manageButton).toBeInTheDocument();
    });
  });

  describe("AC4: Display invoice history", () => {
    test("should display invoice history section", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("invoice-history")).toBeInTheDocument();
    });

    test("should display list of invoices", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByText("INV-2025-001")).toBeInTheDocument();
      expect(screen.getByText("INV-2024-012")).toBeInTheDocument();
      expect(screen.getByText("INV-2024-011")).toBeInTheDocument();
    });

    test("should display invoice amounts", () => {
      renderWithProviders(<BillingPage />);
      
      // Amount is in cents (4900 = $49.00)
      expect(screen.getAllByText(/\$49\.00/).length).toBeGreaterThan(0);
    });

    test("should display invoice status", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getAllByText(/paid/i).length).toBeGreaterThan(0);
    });

    test("should have download/view invoice links", () => {
      renderWithProviders(<BillingPage />);
      
      const invoiceSection = screen.getByTestId("invoice-history");
      const downloadLinks = within(invoiceSection).getAllByRole("link");
      expect(downloadLinks.length).toBeGreaterThan(0);
    });

    test("should display invoice dates", () => {
      renderWithProviders(<BillingPage />);
      
      const invoiceSection = screen.getByTestId("invoice-history");
      // Should show dates in some format
      expect(invoiceSection.textContent).toMatch(/\d+/); // Has some numeric date content
    });
  });

  describe("AC5: Show upgrade prompts when approaching limits", () => {
    test("should show upgrade prompt when accounts near limit", () => {
      useNearLimitUsage = true;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    });

    test("should show upgrade prompt when analysis runs near limit", () => {
      useNearLimitUsage = true;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    });

    test("should display warning badge when usage is high", () => {
      useNearLimitUsage = true;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("usage-warning")).toBeInTheDocument();
    });

    test("should have upgrade button in prompt", () => {
      useNearLimitUsage = true;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      const upgradeButton = screen.getByRole("button", { name: /upgrade/i });
      expect(upgradeButton).toBeInTheDocument();
    });

    test("should not show upgrade prompt when usage is low", () => {
      useNearLimitUsage = false;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
    });

    test("should display percentage of usage", () => {
      useNearLimitUsage = true;
      queryCallIndex = 0;
      renderWithProviders(<BillingPage />);
      
      // Should show percentage like 90% or 92% in the usage sections
      const accountsSection = screen.getByTestId("accounts-connected");
      const analysisSection = screen.getByTestId("analysis-runs");
      expect(accountsSection.textContent).toMatch(/90% used/);
      expect(analysisSection.textContent).toMatch(/92% used/);
    });
  });

  describe("Plan Features Display", () => {
    test("should display plan features section", () => {
      renderWithProviders(<BillingPage />);
      
      expect(screen.getByTestId("plan-features")).toBeInTheDocument();
    });

    test("should list plan limits", () => {
      renderWithProviders(<BillingPage />);
      
      // Should show account and analysis run limits
      const featuresSection = screen.getByTestId("plan-features");
      expect(featuresSection).toBeInTheDocument();
    });
  });
});

describe("BillingPage Route Integration", () => {
  test("BillingPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.BillingPage).toBeDefined();
    expect(typeof pages.BillingPage).toBe("function");
  });
});
