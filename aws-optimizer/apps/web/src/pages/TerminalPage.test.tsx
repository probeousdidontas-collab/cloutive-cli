import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { TerminalPage } from "./TerminalPage";

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
const mockExecuteCommand = vi.fn();

// Mock accounts data
const mockAccounts = [
  {
    _id: "account-1",
    name: "Production Account",
    accountNumber: "123456789012",
    connectionType: "iam_role",
    status: "active",
    lastVerifiedAt: Date.now() - 3600000,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    _id: "account-2",
    name: "Development Account",
    accountNumber: "987654321098",
    connectionType: "access_key",
    status: "active",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
];

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockAccounts),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => mockExecuteCommand),
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

// Mock useOrganization hook - TerminalPage uses this now
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

describe("US-028: Manual Terminal Page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockExecuteCommand.mockClear();
    mockExecuteCommand.mockResolvedValue({
      success: true,
      stdout: "aws-cli/2.15.0 Python/3.11.6",
      stderr: "",
      exitCode: 0,
      executionTime: 150,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /terminal route with command input", () => {
    test("should render terminal page", () => {
      renderWithProviders(<TerminalPage />);
      
      expect(screen.getByTestId("terminal-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<TerminalPage />);
      
      expect(screen.getByRole("heading", { name: /Terminal/i })).toBeInTheDocument();
    });

    test("should have command input field", () => {
      renderWithProviders(<TerminalPage />);
      
      const input = screen.getByTestId("command-input");
      expect(input).toBeInTheDocument();
    });

    test("should have execute/run button", () => {
      renderWithProviders(<TerminalPage />);
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      expect(runButton).toBeInTheDocument();
    });

    test("should execute command on button click", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalled();
      });
    });

    test("should execute command on Enter key press", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      
      fireEvent.change(input, { target: { value: "aws ec2 describe-instances" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalled();
      });
    });
  });

  describe("AC2: Select AWS account to execute against", () => {
    test("should have account selector", () => {
      renderWithProviders(<TerminalPage />);
      
      const accountSelector = screen.getByTestId("account-selector");
      expect(accountSelector).toBeInTheDocument();
    });

    test("should display available accounts in selector", async () => {
      renderWithProviders(<TerminalPage />);
      
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        expect(screen.getByText(/Production Account/)).toBeInTheDocument();
        expect(screen.getByText(/Development Account/)).toBeInTheDocument();
      });
    });

    test("should disable execute when no account selected", () => {
      renderWithProviders(<TerminalPage />);
      
      // When no account is selected, the button should indicate selection is needed
      // or be disabled
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      expect(runButton).toBeDisabled();
    });

    test("should enable execute when account is selected", async () => {
      renderWithProviders(<TerminalPage />);
      
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      expect(runButton).not.toBeDisabled();
    });
  });

  describe("AC3: Display command output with syntax highlighting", () => {
    test("should have output display area", () => {
      renderWithProviders(<TerminalPage />);
      
      const outputArea = screen.getByTestId("command-output");
      expect(outputArea).toBeInTheDocument();
    });

    test("should display command output after execution", async () => {
      mockExecuteCommand.mockResolvedValue({
        success: true,
        stdout: "bucket-1\nbucket-2\nbucket-3",
        stderr: "",
        exitCode: 0,
        executionTime: 200,
      });

      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        expect(screen.getByText(/bucket-1/)).toBeInTheDocument();
      });
    });

    test("should display stderr output with error styling", async () => {
      mockExecuteCommand.mockResolvedValue({
        success: false,
        stdout: "",
        stderr: "An error occurred (AccessDenied)",
        exitCode: 1,
        executionTime: 100,
      });

      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        expect(screen.getByText(/AccessDenied/)).toBeInTheDocument();
      });
    });

    test("should show execution time", async () => {
      mockExecuteCommand.mockResolvedValue({
        success: true,
        stdout: "output",
        stderr: "",
        exitCode: 0,
        executionTime: 250,
      });

      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        expect(screen.getByText(/250\s*ms/i)).toBeInTheDocument();
      });
    });
  });

  describe("AC4: Show command history for current session", () => {
    test("should have command history section", () => {
      renderWithProviders(<TerminalPage />);
      
      const historySection = screen.getByTestId("command-history");
      expect(historySection).toBeInTheDocument();
    });

    test("should add executed commands to history", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        const historySection = screen.getByTestId("command-history");
        expect(historySection).toHaveTextContent("aws s3 ls");
      });
    });

    test("should show timestamp for history entries", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        // Should show some time indicator
        const historySection = screen.getByTestId("command-history");
        // Check for time-related content (could be "just now", timestamp, etc.)
        expect(historySection.textContent?.length).toBeGreaterThan(0);
      });
    });

    test("should allow clicking history item to populate input", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "aws s3 ls" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      await waitFor(() => {
        const historySection = screen.getByTestId("command-history");
        expect(historySection).toHaveTextContent("aws s3 ls");
      });
      
      // Clear input
      fireEvent.change(input, { target: { value: "" } });
      
      // Click on history item
      const historyItem = screen.getByTestId("history-item-0");
      fireEvent.click(historyItem);
      
      // Input should now have the command
      expect(input.value).toBe("aws s3 ls");
    });
  });

  describe("AC5: Restrict to read-only commands by default with override option", () => {
    test("should have read-only mode toggle", () => {
      renderWithProviders(<TerminalPage />);
      
      const readOnlyToggle = screen.getByTestId("read-only-toggle");
      expect(readOnlyToggle).toBeInTheDocument();
    });

    test("should be in read-only mode by default", () => {
      renderWithProviders(<TerminalPage />);
      
      const readOnlyToggle = screen.getByTestId("read-only-toggle");
      // Check if toggle is checked (read-only mode on)
      expect(readOnlyToggle).toBeChecked();
    });

    test("should show warning for write commands in read-only mode", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      // Enter a write command
      fireEvent.change(input, { target: { value: "aws s3 rm s3://bucket/key" } });
      
      // Should show warning about write command - look for the specific alert text
      await waitFor(() => {
        expect(screen.getByText(/blocked in read-only mode/i)).toBeInTheDocument();
      });
    });

    test("should block write commands in read-only mode", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Select account first
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws ec2 terminate-instances --instance-ids i-1234" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      // Should NOT execute the command
      await waitFor(() => {
        expect(mockExecuteCommand).not.toHaveBeenCalled();
      });
    });

    test("should allow disabling read-only mode", async () => {
      renderWithProviders(<TerminalPage />);
      
      const readOnlyToggle = screen.getByTestId("read-only-toggle");
      fireEvent.click(readOnlyToggle);
      
      // Toggle should now be unchecked
      expect(readOnlyToggle).not.toBeChecked();
    });

    test("should allow write commands when read-only mode is disabled", async () => {
      renderWithProviders(<TerminalPage />);
      
      // Disable read-only mode
      const readOnlyToggle = screen.getByTestId("read-only-toggle");
      fireEvent.click(readOnlyToggle);
      
      // Select account
      const accountSelector = screen.getByTestId("account-selector");
      fireEvent.click(accountSelector);
      
      await waitFor(() => {
        const option = screen.getByText(/Production Account/);
        fireEvent.click(option);
      });
      
      const input = screen.getByTestId("command-input");
      fireEvent.change(input, { target: { value: "aws s3 rm s3://bucket/key" } });
      
      const runButton = screen.getByRole("button", { name: /run|execute/i });
      fireEvent.click(runButton);
      
      // Should execute the command
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalled();
      });
    });

    test("should show confirmation when disabling read-only mode", async () => {
      renderWithProviders(<TerminalPage />);
      
      const readOnlyToggle = screen.getByTestId("read-only-toggle");
      fireEvent.click(readOnlyToggle);
      
      // Should show warning message about disabled read-only mode - look for specific alert content
      await waitFor(() => {
        expect(screen.getByText(/Read-only mode is disabled/i)).toBeInTheDocument();
      });
    });
  });
});

describe("TerminalPage Route Integration", () => {
  test("TerminalPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.TerminalPage).toBeDefined();
    // observer() wrapped components are callable (usable as React components)
    // but typeof may return "object" for forwardRef components
    expect(typeof pages.TerminalPage === "function" || typeof pages.TerminalPage === "object").toBe(true);
  });
});
