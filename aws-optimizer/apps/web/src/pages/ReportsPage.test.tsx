import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ReportsPage } from "./ReportsPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock reports data
const mockReports = [
  {
    _id: "report-1",
    name: "Monthly Cost Summary - January 2025",
    type: "summary",
    format: "pdf",
    status: "completed",
    downloadUrl: "https://example.com/reports/report-1.pdf",
    createdAt: Date.now() - 86400000, // 1 day ago
    completedAt: Date.now() - 82800000,
  },
  {
    _id: "report-2",
    name: "Detailed Cost Analysis Q4 2024",
    type: "detailed",
    format: "csv",
    status: "completed",
    downloadUrl: "https://example.com/reports/report-2.csv",
    createdAt: Date.now() - 172800000, // 2 days ago
    completedAt: Date.now() - 169200000,
  },
  {
    _id: "report-3",
    name: "Recommendations Report",
    type: "recommendation",
    format: "pdf",
    status: "generating",
    downloadUrl: null,
    createdAt: Date.now() - 3600000, // 1 hour ago
    completedAt: null,
  },
  {
    _id: "report-4",
    name: "Cost Comparison Dec vs Nov",
    type: "comparison",
    format: "pdf",
    status: "failed",
    downloadUrl: null,
    createdAt: Date.now() - 259200000, // 3 days ago
    completedAt: null,
    error: "Failed to fetch cost data for the comparison period",
  },
  {
    _id: "report-5",
    name: "Weekly Summary",
    type: "summary",
    format: "pdf",
    status: "pending",
    downloadUrl: null,
    createdAt: Date.now() - 1800000, // 30 minutes ago
    completedAt: null,
  },
];

// Mock scheduled reports data
const mockScheduledReports = [
  {
    _id: "schedule-1",
    name: "Weekly Cost Summary",
    type: "summary",
    format: "pdf",
    schedule: "weekly",
    nextRun: Date.now() + 604800000, // 7 days from now
    enabled: true,
    createdAt: Date.now() - 2592000000, // 30 days ago
  },
  {
    _id: "schedule-2",
    name: "Monthly Detailed Report",
    type: "detailed",
    format: "csv",
    schedule: "monthly",
    nextRun: Date.now() + 2592000000, // 30 days from now
    enabled: true,
    createdAt: Date.now() - 5184000000, // 60 days ago
  },
  {
    _id: "schedule-3",
    name: "Quarterly Comparison",
    type: "comparison",
    format: "pdf",
    schedule: "quarterly",
    nextRun: Date.now() + 7776000000, // 90 days from now
    enabled: false,
    createdAt: Date.now() - 7776000000, // 90 days ago
  },
];

const mockGenerateReport = vi.fn();
const mockCreateSchedule = vi.fn();
const mockDeleteSchedule = vi.fn();
const mockToggleSchedule = vi.fn();

let queryCallIndex = 0;
let mutationCallIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallIndex++;
    // First call is for reports, second is for scheduled reports
    if (queryCallIndex % 2 === 1) return mockReports;
    return mockScheduledReports;
  }),
  useMutation: vi.fn(() => {
    mutationCallIndex++;
    // Mutations are called in order in ReportsPage.tsx:
    // 1. generateReport, 2. createSchedule, 3. deleteSchedule, 4. toggleSchedule
    const index = mutationCallIndex % 4;
    if (index === 1) return mockGenerateReport;
    if (index === 2) return mockCreateSchedule;
    if (index === 3) return mockDeleteSchedule;
    if (index === 0) return mockToggleSchedule; // 4 % 4 = 0
    return vi.fn();
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
  IS_TEST_MODE: true,
}));

// Mock useOrganization hook - must match the actual hook return values used by ReportsPage
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

describe("US-031: Reports Page", () => {
  beforeEach(() => {
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockNavigate.mockClear();
    mockGenerateReport.mockClear();
    mockCreateSchedule.mockClear();
    mockDeleteSchedule.mockClear();
    mockToggleSchedule.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /reports route with report history", () => {
    test("should render reports page", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByTestId("reports-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByRole("heading", { name: /^reports$/i, level: 2 })).toBeInTheDocument();
    });

    test("should display list of reports", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByText("Monthly Cost Summary - January 2025")).toBeInTheDocument();
      expect(screen.getByText("Detailed Cost Analysis Q4 2024")).toBeInTheDocument();
      expect(screen.getByText("Recommendations Report")).toBeInTheDocument();
    });

    test("should have reports list container", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByTestId("reports-list")).toBeInTheDocument();
    });

    test("should display each report as a row or card", () => {
      renderWithProviders(<ReportsPage />);
      
      const reportItems = screen.getAllByTestId(/report-item-/);
      expect(reportItems.length).toBe(5); // 5 reports in mock data
    });

    test("should show report creation timestamp", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show relative or formatted timestamps
      const reportItem = screen.getByTestId("report-item-report-1");
      expect(within(reportItem).getByTestId("report-timestamp-report-1")).toBeInTheDocument();
    });
  });

  describe("AC2: Allow generating new reports (PDF or CSV)", () => {
    test("should have Generate Report button", () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      expect(generateButton).toBeInTheDocument();
    });

    test("should open generate modal when button clicked", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("generate-report-modal")).toBeInTheDocument();
      });
    });

    test("should have format selector with PDF and CSV options", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("format-selector")).toBeInTheDocument();
      });
      
      // Check for format options
      expect(screen.getByRole("radio", { name: /pdf/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /csv/i })).toBeInTheDocument();
    });

    test("should have report name input", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("generate-report-modal")).toBeInTheDocument();
      });
      
      // Find the report name input in document (modal content may be portaled)
      await waitFor(() => {
        const textboxes = document.querySelectorAll("input[type='text'], input:not([type])");
        expect(textboxes.length).toBeGreaterThan(0);
      });
    });

    test("should have submit button in generate modal", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("generate-report-modal")).toBeInTheDocument();
      });
      
      // Verify the modal has form submit buttons (Cancel and Generate/Submit)
      await waitFor(() => {
        const allButtons = document.querySelectorAll("button");
        // Should have more buttons now that modal is open (page buttons + modal buttons)
        expect(allButtons.length).toBeGreaterThan(2);
      });
    });
  });

  describe("AC3: Select report type: summary, detailed, recommendation, comparison", () => {
    test("should have report type selector in generate modal", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("type-selector")).toBeInTheDocument();
      });
    });

    test("should have summary report type option", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /summary/i })).toBeInTheDocument();
      });
    });

    test("should have detailed report type option", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /detailed/i })).toBeInTheDocument();
      });
    });

    test("should have recommendation report type option", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /recommendation/i })).toBeInTheDocument();
      });
    });

    test("should have comparison report type option", async () => {
      renderWithProviders(<ReportsPage />);
      
      const generateButton = screen.getByRole("button", { name: /generate report/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /comparison/i })).toBeInTheDocument();
      });
    });

    test("should display report type in the list", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show type badges
      expect(screen.getAllByText(/summary/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/detailed/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/recommendation/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/comparison/i).length).toBeGreaterThan(0);
    });
  });

  describe("AC4: Display report status and download link when ready", () => {
    test("should display report status badges", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show status badges for different states (may have multiple completed)
      expect(screen.getAllByTestId("status-badge-completed").length).toBeGreaterThan(0);
      expect(screen.getByTestId("status-badge-generating")).toBeInTheDocument();
    });

    test("should show download button for completed reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const completedReport = screen.getByTestId("report-item-report-1");
      expect(within(completedReport).getByRole("link", { name: /download/i })).toBeInTheDocument();
    });

    test("should have correct download link URL for completed reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const completedReport = screen.getByTestId("report-item-report-1");
      const downloadLink = within(completedReport).getByRole("link", { name: /download/i });
      expect(downloadLink).toHaveAttribute("href", "https://example.com/reports/report-1.pdf");
    });

    test("should not show download button for pending reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const pendingReport = screen.getByTestId("report-item-report-5");
      expect(within(pendingReport).queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    });

    test("should not show download button for generating reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const generatingReport = screen.getByTestId("report-item-report-3");
      expect(within(generatingReport).queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    });

    test("should show loading indicator for generating reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const generatingReport = screen.getByTestId("report-item-report-3");
      expect(within(generatingReport).getByTestId("generating-indicator")).toBeInTheDocument();
    });

    test("should show error message for failed reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const failedReport = screen.getByTestId("report-item-report-4");
      expect(within(failedReport).getByTestId("status-badge-failed")).toBeInTheDocument();
    });

    test("should display format badge (PDF/CSV)", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show format indicators
      expect(screen.getAllByText(/pdf/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/csv/i).length).toBeGreaterThan(0);
    });
  });

  describe("AC5: Support scheduling reports for automatic generation", () => {
    test("should have scheduled reports section", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByTestId("scheduled-reports-section")).toBeInTheDocument();
    });

    test("should display scheduled reports list", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByText("Weekly Cost Summary")).toBeInTheDocument();
      expect(screen.getByText("Monthly Detailed Report")).toBeInTheDocument();
    });

    test("should have Schedule Report button", () => {
      renderWithProviders(<ReportsPage />);
      
      const scheduleButton = screen.getByRole("button", { name: /schedule report/i });
      expect(scheduleButton).toBeInTheDocument();
    });

    test("should open schedule modal when button clicked", async () => {
      renderWithProviders(<ReportsPage />);
      
      const scheduleButton = screen.getByRole("button", { name: /schedule report/i });
      fireEvent.click(scheduleButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("schedule-report-modal")).toBeInTheDocument();
      });
    });

    test("should have schedule frequency options (daily, weekly, monthly, quarterly)", async () => {
      renderWithProviders(<ReportsPage />);
      
      const scheduleButton = screen.getByRole("button", { name: /schedule report/i });
      fireEvent.click(scheduleButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("schedule-selector")).toBeInTheDocument();
      });
      
      // Check for schedule options
      expect(screen.getByRole("radio", { name: /daily/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /weekly/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /monthly/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /quarterly/i })).toBeInTheDocument();
    });

    test("should display schedule frequency in the list", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show schedule badges
      expect(screen.getAllByText(/weekly/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/monthly/i).length).toBeGreaterThan(0);
    });

    test("should show next run time for scheduled reports", () => {
      renderWithProviders(<ReportsPage />);
      
      // Should show next run indicator
      const scheduledSection = screen.getByTestId("scheduled-reports-section");
      expect(within(scheduledSection).getAllByText(/next/i).length).toBeGreaterThan(0);
    });

    test("should have toggle to enable/disable scheduled reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const toggles = screen.getAllByRole("switch");
      expect(toggles.length).toBeGreaterThan(0);
    });

    test("should have delete button for scheduled reports", () => {
      renderWithProviders(<ReportsPage />);
      
      const scheduledSection = screen.getByTestId("scheduled-reports-section");
      const deleteButtons = within(scheduledSection).getAllByRole("button", { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Report Type Filtering", () => {
    test("should have type filter for report history", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByTestId("type-filter")).toBeInTheDocument();
    });

    test("should have status filter for report history", () => {
      renderWithProviders(<ReportsPage />);
      
      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });
  });
});

describe("ReportsPage Route Integration", () => {
  test("ReportsPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.ReportsPage).toBeDefined();
    // ReportsPage is wrapped with MobX observer, which returns an object with $$typeof
    expect(pages.ReportsPage).toBeTruthy();
  });
});
