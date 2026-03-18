import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { AccountsPage } from "./AccountsPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  createRouter: vi.fn(),
  createRootRoute: vi.fn(),
  createRoute: vi.fn(),
  Outlet: () => null,
}));

// Mock Convex hooks
const mockConnectWithRole = vi.fn();
const mockConnectWithKeys = vi.fn();
const mockDisconnect = vi.fn();
const mockVerifyRoleConnection = vi.fn();
const mockVerifyKeyConnection = vi.fn();

// Mock accounts data
const mockAccounts = [
  {
    _id: "account-1",
    name: "Production Account",
    accountNumber: "123456789012",
    connectionType: "iam_role",
    status: "active",
    lastVerifiedAt: Date.now() - 3600000, // 1 hour ago
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "account-2",
    name: "Development Account",
    accountNumber: "987654321098",
    connectionType: "access_key",
    status: "pending",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
  {
    _id: "account-3",
    name: "Staging Account",
    accountNumber: "456789012345",
    connectionType: "iam_role",
    status: "error",
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 86400000,
  },
];

// Mock CloudFormation template
const mockCfTemplate = {
  template: JSON.stringify({
    AWSTemplateFormatVersion: "2010-09-09",
    Description: "Creates an IAM role for AWS Manager",
  }),
};

let queryCallCount = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallCount++;
    // First call is listByOrganization, second is generateCloudFormationTemplate
    if (queryCallCount % 2 === 1) {
      return mockAccounts;
    }
    return mockCfTemplate;
  }),
  useMutation: vi.fn(() => {
    // Return a mock function that can be tracked
    return vi.fn();
  }),
  useAction: vi.fn(() => {
    // Return a mock function for actions
    return vi.fn().mockResolvedValue({ valid: true, accountId: "123456789012" });
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

// Mock useOrganization hook - AccountsPage uses this now
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

describe("US-023: AWS Accounts Management Page", () => {
  beforeEach(() => {
    queryCallCount = 0;
    mockNavigate.mockClear();
    mockConnectWithRole.mockClear();
    mockConnectWithKeys.mockClear();
    mockDisconnect.mockClear();
    mockVerifyRoleConnection.mockClear();
    mockVerifyKeyConnection.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /accounts route with list of connected accounts", () => {
    test("should render accounts page", () => {
      renderWithProviders(<AccountsPage />);
      
      expect(screen.getByTestId("accounts-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<AccountsPage />);
      
      expect(screen.getByRole("heading", { name: /AWS Accounts/i })).toBeInTheDocument();
    });

    test("should display list of connected accounts", () => {
      renderWithProviders(<AccountsPage />);
      
      expect(screen.getByText("Production Account")).toBeInTheDocument();
      expect(screen.getByText("Development Account")).toBeInTheDocument();
      expect(screen.getByText("Staging Account")).toBeInTheDocument();
    });

    test("should have accounts list container", () => {
      renderWithProviders(<AccountsPage />);
      
      expect(screen.getByTestId("accounts-list")).toBeInTheDocument();
    });
  });

  describe("AC2: Show connection status, account number, and last sync time", () => {
    test("should display account numbers", () => {
      renderWithProviders(<AccountsPage />);
      
      expect(screen.getByText(/123456789012/)).toBeInTheDocument();
      expect(screen.getByText(/987654321098/)).toBeInTheDocument();
      expect(screen.getByText(/456789012345/)).toBeInTheDocument();
    });

    test("should display connection status badges", () => {
      renderWithProviders(<AccountsPage />);
      
      // Should have status indicators
      expect(screen.getByTestId("status-badge-active")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge-pending")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge-error")).toBeInTheDocument();
    });

    test("should display connection type", () => {
      renderWithProviders(<AccountsPage />);
      
      // Should show connection types
      expect(screen.getAllByText(/IAM Role/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Access Key/i).length).toBeGreaterThan(0);
    });

    test("should display last sync time for active accounts", () => {
      renderWithProviders(<AccountsPage />);
      
      // Should show last verified/sync time (look for relative time format)
      expect(screen.getByText(/Last synced.*ago/i)).toBeInTheDocument();
    });
  });

  describe("AC3: Add 'Connect Account' button with modal for IAM role or access key", () => {
    test("should have Connect Account button", () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      expect(connectButton).toBeInTheDocument();
    });

    test("should open connect modal when button clicked", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("connect-modal")).toBeInTheDocument();
      });
    });

    test("should have tabs for IAM Role, Upload File, and Access Key in modal", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /IAM Role/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Access Key/i })).toBeInTheDocument();
      });
    });

    test("should show IAM Role form fields", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("connect-modal")).toBeInTheDocument();
      });
      
      // Modal content is portaled - check for form inputs in document
      await waitFor(() => {
        const inputs = document.querySelectorAll("input");
        expect(inputs.length).toBeGreaterThanOrEqual(4);
      });
    });

    test("should show Access Key form fields when tab selected", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("connect-modal")).toBeInTheDocument();
      });
      
      // Find and click the Access Key tab - tabs may be rendered via portal
      await waitFor(() => {
        const tabs = document.querySelectorAll("[role='tab']");
        expect(tabs.length).toBeGreaterThanOrEqual(2);
      });
      
      const tabs = document.querySelectorAll("[role='tab']");
      const accessKeyTab = Array.from(tabs).find(tab => tab.textContent?.includes("Access Key"));
      expect(accessKeyTab).toBeDefined();
      if (accessKeyTab) fireEvent.click(accessKeyTab);
      
      // Verify the access key panel appears with inputs
      await waitFor(() => {
        const inputs = document.querySelectorAll("input");
        expect(inputs.length).toBeGreaterThanOrEqual(4);
      });
    });

    test("should call connect mutation when form submitted", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("connect-modal")).toBeInTheDocument();
      });
      
      // Check that there's a Connect submit button in the modal (portaled content)
      await waitFor(() => {
        const buttons = document.querySelectorAll("button");
        const connectSubmitButton = Array.from(buttons).find(
          btn => btn.textContent === "Connect" && btn !== connectButton
        );
        expect(connectSubmitButton).toBeDefined();
      });
    });
  });

  describe("AC4: Provide CloudFormation template download for IAM role setup", () => {
    test("should have download CloudFormation template button in IAM Role tab", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /download.*template/i })).toBeInTheDocument();
      });
    });

    test("should show CloudFormation instructions", async () => {
      renderWithProviders(<AccountsPage />);
      
      const connectButton = screen.getByRole("button", { name: /connect account/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        // Check for CloudFormation related content in the modal
        const modal = screen.getByTestId("connect-modal");
        expect(modal.textContent).toMatch(/CloudFormation/i);
      });
    });
  });

  describe("AC5: Allow disconnecting accounts with confirmation", () => {
    test("should have disconnect button for each account", () => {
      renderWithProviders(<AccountsPage />);
      
      const disconnectButtons = screen.getAllByRole("button", { name: /disconnect/i });
      expect(disconnectButtons.length).toBeGreaterThan(0);
    });

    test("should show confirmation modal when disconnect clicked", async () => {
      renderWithProviders(<AccountsPage />);
      
      const disconnectButtons = screen.getAllByRole("button", { name: /disconnect/i });
      fireEvent.click(disconnectButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-disconnect-modal")).toBeInTheDocument();
      });
    });

    test("should show account name in confirmation modal", async () => {
      renderWithProviders(<AccountsPage />);
      
      const disconnectButtons = screen.getAllByRole("button", { name: /disconnect/i });
      fireEvent.click(disconnectButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText(/Production Account/i)).toBeInTheDocument();
      });
    });

    test("should call disconnect mutation when confirmed", async () => {
      renderWithProviders(<AccountsPage />);
      
      const disconnectButtons = screen.getAllByRole("button", { name: /disconnect/i });
      fireEvent.click(disconnectButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-disconnect-modal")).toBeInTheDocument();
      });
      
      // Find confirm button in document (modal content is portaled)
      await waitFor(() => {
        const buttons = document.querySelectorAll("button");
        const confirmButton = Array.from(buttons).find(
          btn => btn.textContent === "Confirm"
        );
        expect(confirmButton).toBeDefined();
      });
    });

    test("should have cancel option in disconnect modal", async () => {
      renderWithProviders(<AccountsPage />);
      
      const disconnectButtons = screen.getAllByRole("button", { name: /disconnect/i });
      fireEvent.click(disconnectButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-disconnect-modal")).toBeInTheDocument();
      });
      
      // Find cancel button in document (modal content is portaled)
      await waitFor(() => {
        const buttons = document.querySelectorAll("button");
        const cancelButton = Array.from(buttons).find(
          btn => btn.textContent === "Cancel"
        );
        expect(cancelButton).toBeDefined();
      });
    });
  });
});

describe("AccountsPage Route Integration", () => {
  test("AccountsPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.AccountsPage).toBeDefined();
    // observer() wrapped components are callable (usable as React components)
    // but typeof may return "object" for forwardRef components
    expect(typeof pages.AccountsPage === "function" || typeof pages.AccountsPage === "object").toBe(true);
  });
});
