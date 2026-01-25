/**
 * ActivityPage Tests
 *
 * Tests for US-045: Activity logging page
 *
 * Acceptance Criteria:
 * 3. Create /settings/activity route to view logs
 * 4. Filter by user, action type, and date range
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ActivityPage } from "./ActivityPage";

// Mock Convex
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
  };
});

import { useQuery } from "convex/react";

const mockUseQuery = vi.mocked(useQuery);

const mockLogs = {
  logs: [
    {
      _id: "log1",
      organizationId: "org1",
      userId: "user1",
      action: "create" as const,
      entityType: "aws_account" as const,
      entityId: "account-123",
      createdAt: Date.now() - 1000 * 60 * 5, // 5 minutes ago
      user: {
        _id: "user1",
        name: "John Doe",
        email: "john@example.com",
      },
    },
    {
      _id: "log2",
      organizationId: "org1",
      userId: "user2",
      action: "update" as const,
      entityType: "organization" as const,
      entityId: "org1",
      details: {
        description: "Updated organization name",
      },
      createdAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
      user: {
        _id: "user2",
        name: "Jane Smith",
        email: "jane@example.com",
      },
    },
    {
      _id: "log3",
      organizationId: "org1",
      userId: "user1",
      action: "delete" as const,
      entityType: "budget" as const,
      entityId: "budget-456",
      createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      user: {
        _id: "user1",
        name: "John Doe",
        email: "john@example.com",
      },
    },
  ],
  hasMore: false,
};

// Users are included in mockLogs.logs[].user

const renderWithProviders = (component: React.ReactNode) => {
  const client = new ConvexReactClient("https://test.convex.cloud");
  return render(
    <ConvexProvider client={client}>
      <MantineProvider>{component}</MantineProvider>
    </ConvexProvider>
  );
};

describe("ActivityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the activity page with title", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText("Activity Log")).toBeInTheDocument();
    expect(screen.getByText("View all actions taken in your organization")).toBeInTheDocument();
  });

  it("renders activity logs in a table", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    // Check that log entries are rendered (use getAllByText since names appear multiple times)
    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jane Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows loading state when data is loading", () => {
    mockUseQuery.mockReturnValue(undefined);

    renderWithProviders(<ActivityPage />);

    // Should show skeletons when loading
    expect(screen.getByTestId("activity-table")).toBeInTheDocument();
  });

  it("shows empty state when no logs exist", () => {
    mockUseQuery.mockImplementation(() => ({ logs: [], hasMore: false }));

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText("No activity logs found")).toBeInTheDocument();
  });

  it("renders filter controls", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    expect(screen.getByTestId("filters-section")).toBeInTheDocument();
    expect(screen.getByTestId("user-filter")).toBeInTheDocument();
    expect(screen.getByTestId("action-filter")).toBeInTheDocument();
    expect(screen.getByTestId("entity-type-filter")).toBeInTheDocument();
    expect(screen.getByTestId("date-range-filter")).toBeInTheDocument();
  });

  it("renders reset filters button", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    expect(screen.getByTestId("reset-filters-button")).toBeInTheDocument();
  });

  it("displays retention notice", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText("Activity logs are retained for 90 days")).toBeInTheDocument();
  });

  it("displays details when available", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText("Updated organization name")).toBeInTheDocument();
  });

  it("formats entity types correctly", () => {
    mockUseQuery.mockImplementation(() => mockLogs);

    renderWithProviders(<ActivityPage />);

    // Use getAllByText since entity types may appear multiple times (in filter dropdown and table)
    expect(screen.getAllByText("Aws Account").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Organization").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Budget").length).toBeGreaterThan(0);
  });
});
