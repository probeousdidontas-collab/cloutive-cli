import { useState, useMemo, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Modal,
  TextInput,
  Badge,
  Table,
  ActionIcon,
  Tooltip,
  Skeleton,
  Box,
  Divider,
  Radio,
  Switch,
  Loader,
  Anchor,
  MultiSelect,
  Card,
  Center,
  ScrollArea,
  TypographyStylesProvider,
  Progress,
  RingProgress,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconFileText,
  IconDownload,
  IconTrash,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconLoader,
  IconCalendarEvent,
  IconFilter,
  IconFilterOff,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconUser,
  IconCloud,
  IconEye,
  IconServer,
  IconFileExport,
  IconRefresh,
  IconKey,
  IconCloudOff,
  IconRobot,
  IconClockOff,
  IconInfoCircle,
} from "@tabler/icons-react";
import { marked } from "marked";
import { ReportPdfDocument } from "../components/ReportPdfDocument";
import { CostAnalysisReportPdf } from "../components/CostAnalysisReportPdf";
import type { CostAnalysisReportData } from "@aws-optimizer/convex/convex/ai/costAnalysisTypes";
import { useQuery, useMutation } from "convex/react";
import { observer } from "mobx-react-lite";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { useSession, IS_TEST_MODE } from "../lib/auth-client";
import { useOrganization } from "../hooks/useOrganization";

type ReportType = "summary" | "detailed" | "recommendation" | "comparison";
type ReportFormat = "pdf" | "csv";
type ReportStatus = "pending" | "generating" | "completed" | "failed";
type ScheduleFrequency = "daily" | "weekly" | "monthly" | "quarterly";

type ErrorCategory = 
  | "configuration"
  | "authentication" 
  | "no_accounts"
  | "aws_access"
  | "ai_agent"
  | "timeout"
  | "unknown";

interface ParsedError {
  category: ErrorCategory;
  message: string;
  details?: string;
  suggestion?: string;
}

interface Report {
  _id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  downloadUrl: string | null;
  createdAt: number;
  completedAt: number | null;
  hasContent?: boolean;
  hasReportData?: boolean;
  errorMessage?: string;
  // Progress tracking
  progressStep?: number;
  progressMessage?: string;
  progressPercent?: number;
}

interface ReportDetail {
  _id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  content?: string;
  reportData?: string;
  downloadUrl: string | null;
  createdAt: number;
  completedAt: number | null;
  errorMessage?: string;
  awsAccountIds?: string[];
  // Progress tracking
  progressStep?: number;
  progressMessage?: string;
  progressPercent?: number;
}

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

interface ScheduledReport {
  _id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  schedule: ScheduleFrequency;
  nextRun: number;
  enabled: boolean;
  createdAt: number;
}

function getStatusColor(status: ReportStatus): string {
  const colors: Record<ReportStatus, string> = {
    completed: "green",
    generating: "blue",
    pending: "gray",
    failed: "red",
  };
  return colors[status] || "gray";
}

function getStatusIcon(status: ReportStatus) {
  const icons: Record<ReportStatus, React.ReactNode> = {
    completed: <IconCheck size={14} />,
    generating: <IconLoader size={14} />,
    pending: <IconClock size={14} />,
    failed: <IconAlertCircle size={14} />,
  };
  return icons[status] || null;
}

function getTypeColor(type: ReportType): string {
  const colors: Record<ReportType, string> = {
    summary: "blue",
    detailed: "violet",
    recommendation: "orange",
    comparison: "teal",
  };
  return colors[type] || "gray";
}

function getScheduleColor(schedule: ScheduleFrequency): string {
  const colors: Record<ScheduleFrequency, string> = {
    daily: "cyan",
    weekly: "blue",
    monthly: "violet",
    quarterly: "grape",
  };
  return colors[schedule] || "gray";
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFutureTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;

  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `in ${days} day${days !== 1 ? "s" : ""}`;
  if (hours > 0) return `in ${hours} hour${hours !== 1 ? "s" : ""}`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Parse a formatted error message from the backend.
 * Expected format: "[CATEGORY] Message | Details: ... | Suggestion: ..."
 */
function parseErrorMessage(errorMessage?: string): ParsedError {
  if (!errorMessage) {
    return {
      category: "unknown",
      message: "An unknown error occurred",
      suggestion: "Please try again or contact support.",
    };
  }

  // Try to parse structured error format
  const categoryMatch = errorMessage.match(/^\[([A-Z_]+)\]\s*(.+?)(?:\s*\||$)/);
  const detailsMatch = errorMessage.match(/Details:\s*(.+?)(?:\s*\||$)/);
  const suggestionMatch = errorMessage.match(/Suggestion:\s*(.+?)(?:\s*\||$)/);

  if (categoryMatch) {
    return {
      category: categoryMatch[1].toLowerCase() as ErrorCategory,
      message: categoryMatch[2].trim(),
      details: detailsMatch?.[1]?.trim(),
      suggestion: suggestionMatch?.[1]?.trim(),
    };
  }

  // Fallback for unstructured error messages
  return {
    category: "unknown",
    message: "Report generation failed",
    details: errorMessage,
    suggestion: "Please try again. If the problem persists, contact support.",
  };
}

/**
 * Get the icon for an error category.
 */
function getErrorIcon(category: ErrorCategory) {
  const icons: Record<ErrorCategory, React.ReactNode> = {
    configuration: <IconKey size={20} />,
    authentication: <IconKey size={20} />,
    no_accounts: <IconCloudOff size={20} />,
    aws_access: <IconCloud size={20} />,
    ai_agent: <IconRobot size={20} />,
    timeout: <IconClockOff size={20} />,
    unknown: <IconAlertCircle size={20} />,
  };
  return icons[category] || icons.unknown;
}

/**
 * Get the color for an error category.
 */
function getErrorColor(category: ErrorCategory): string {
  const colors: Record<ErrorCategory, string> = {
    configuration: "orange",
    authentication: "orange",
    no_accounts: "yellow",
    aws_access: "red",
    ai_agent: "violet",
    timeout: "blue",
    unknown: "red",
  };
  return colors[category] || "red";
}

export const ReportsPage = observer(function ReportsPage() {
  const { data: session, isPending: isSessionPending } = useSession();

  // Wait for authentication before executing queries
  const isAuthenticated = !isSessionPending && session !== null;

  // Use organization state from MobX store
  const {
    activeOrganization,
    convexOrgId,
    isLoading: isLoadingOrg,
    isReady: isOrgReady,
  } = useOrganization();

  // Use the resolved Convex organization ID from the store
  const organizationId = convexOrgId;

  // Modal states
  const [generateModalOpened, { open: openGenerateModal, close: closeGenerateModal }] = useDisclosure(false);
  const [scheduleModalOpened, { open: openScheduleModal, close: closeScheduleModal }] = useDisclosure(false);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Form states for generate modal
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("pdf");
  const [selectedAwsAccountIds, setSelectedAwsAccountIds] = useState<string[]>([]);

  // Form states for schedule modal
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleType, setScheduleType] = useState<ReportType>("summary");
  const [scheduleFormat, setScheduleFormat] = useState<ReportFormat>("pdf");
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>("weekly");

  // Filter states
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // In test mode, use empty args (backend handles test mode)
  // Otherwise, pass the Convex organization ID
  const shouldQueryReports = isAuthenticated && isOrgReady && (IS_TEST_MODE || organizationId);

  // Fetch data - pass organization ID for proper multi-org support
  const reportsData = useQuery(
    api.reports.list,
    shouldQueryReports
      ? IS_TEST_MODE
        ? {} // Empty args for test mode - backend returns mock data
        : { organizationId: organizationId! }
      : "skip"
  );
  const scheduledReportsData = useQuery(
    api.reports.listScheduled,
    shouldQueryReports
      ? IS_TEST_MODE
        ? {}
        : { organizationId: organizationId! }
      : "skip"
  );
  
  // Fetch AWS accounts for the organization
  const awsAccountsData = useQuery(
    api.awsAccounts.listByOrganization,
    shouldQueryReports && organizationId
      ? { organizationId: organizationId }
      : "skip"
  );
  
  // Fetch selected report details
  const reportDetailData = useQuery(
    api.reports.get,
    selectedReportId ? { reportId: selectedReportId as unknown as Parameters<typeof api.reports.get>[0]["reportId"] } : "skip"
  );
  
  const reports = reportsData as Report[] | undefined;
  const scheduledReports = scheduledReportsData as ScheduledReport[] | undefined;
  const awsAccounts = awsAccountsData as AwsAccount[] | undefined;
  const reportDetail = reportDetailData as ReportDetail | null | undefined;

  // Mutations
  const generateReport = useMutation(api.reports.generate);
  const generateCostAnalysis = useMutation(api.reports.generateCostAnalysis);
  const createSchedule = useMutation(api.reports.createSchedule);
  const deleteSchedule = useMutation(api.reports.deleteSchedule);
  const toggleSchedule = useMutation(api.reports.toggleSchedule);

  // Filter options
  const typeOptions = [
    { value: "summary", label: "Summary" },
    { value: "detailed", label: "Detailed" },
    { value: "recommendation", label: "Recommendation" },
    { value: "comparison", label: "Comparison" },
  ];

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "generating", label: "Generating" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
  ];

  // Filter reports
  const filteredReports = useMemo(() => {
    if (!reports) return [];

    return reports
      .filter((report) => {
        if (selectedTypes.length > 0 && !selectedTypes.includes(report.type)) {
          return false;
        }
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(report.status)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, selectedTypes, selectedStatuses]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
  }, []);

  // AWS account options for the select
  const awsAccountOptions = useMemo(() => {
    if (!awsAccounts) return [];
    return awsAccounts
      .filter((acc) => acc.status === "active")
      .map((acc) => ({
        value: acc._id,
        label: `${acc.name} (${acc.accountNumber})`,
      }));
  }, [awsAccounts]);

  // Reset generate form
  const resetGenerateForm = useCallback(() => {
    setReportName("");
    setReportType("summary");
    setReportFormat("pdf");
    setSelectedAwsAccountIds([]);
  }, []);

  // Reset schedule form
  const resetScheduleForm = useCallback(() => {
    setScheduleName("");
    setScheduleType("summary");
    setScheduleFormat("pdf");
    setScheduleFrequency("weekly");
  }, []);

  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    const awsAccountIdsArg = selectedAwsAccountIds.length > 0 ? selectedAwsAccountIds : undefined;
    if (reportType === "summary") {
      // Use cost analysis pipeline for summary reports
      if (IS_TEST_MODE) {
        await generateCostAnalysis({ name: reportName, awsAccountIds: awsAccountIdsArg });
      } else {
        await generateCostAnalysis({ organizationId: organizationId!, name: reportName, awsAccountIds: awsAccountIdsArg });
      }
    } else {
      if (IS_TEST_MODE) {
        await generateReport({ name: reportName, type: reportType, format: reportFormat, awsAccountIds: awsAccountIdsArg });
      } else {
        await generateReport({ organizationId: organizationId!, name: reportName, type: reportType, format: reportFormat, awsAccountIds: awsAccountIdsArg });
      }
    }
    closeGenerateModal();
    resetGenerateForm();
  }, [reportName, reportType, reportFormat, selectedAwsAccountIds, organizationId, generateReport, generateCostAnalysis, closeGenerateModal, resetGenerateForm]);

  // Handle view report
  const handleViewReport = useCallback((reportId: string) => {
    setSelectedReportId(reportId);
    openDetailModal();
  }, [openDetailModal]);

  // Handle close detail modal
  const handleCloseDetailModal = useCallback(() => {
    closeDetailModal();
    setSelectedReportId(null);
  }, [closeDetailModal]);

  // Render markdown content as HTML (synchronous)
  const renderedContent = useMemo(() => {
    if (!reportDetail?.content) return "";
    return marked.parse(reportDetail.content, { async: false }) as string;
  }, [reportDetail?.content]);

  // PDF export state
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Handle PDF export
  const handleExportPdf = useCallback(async () => {
    if (!reportDetail) return;

    setIsExportingPdf(true);
    try {
      let blob: Blob;

      if (reportDetail.reportData) {
        // Cost analysis report with structured data
        const data: CostAnalysisReportData = JSON.parse(reportDetail.reportData);
        blob = await pdf(<CostAnalysisReportPdf data={data} />).toBlob();
      } else if (reportDetail.content) {
        // Markdown-based report
        blob = await pdf(
          <ReportPdfDocument
            title={reportDetail.name}
            content={reportDetail.content}
            reportType={reportDetail.type}
            generatedAt={reportDetail.completedAt || undefined}
          />
        ).toBlob();
      } else {
        return;
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportDetail.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExportingPdf(false);
    }
  }, [reportDetail]);

  // Handle create schedule
  const handleCreateSchedule = useCallback(async () => {
    const args = IS_TEST_MODE
      ? { name: scheduleName, type: scheduleType, format: scheduleFormat, schedule: scheduleFrequency }
      : { organizationId: organizationId!, name: scheduleName, type: scheduleType, format: scheduleFormat, schedule: scheduleFrequency };
    await createSchedule(args);
    closeScheduleModal();
    resetScheduleForm();
  }, [scheduleName, scheduleType, scheduleFormat, scheduleFrequency, organizationId, createSchedule, closeScheduleModal, resetScheduleForm]);

  // Handle toggle schedule
  const handleToggleSchedule = useCallback(
    async (scheduleId: string, enabled: boolean) => {
      await toggleSchedule({ id: scheduleId, enabled });
    },
    [toggleSchedule]
  );

  // Handle delete schedule
  const handleDeleteSchedule = useCallback(
    async (scheduleId: string) => {
      await deleteSchedule({ id: scheduleId });
    },
    [deleteSchedule]
  );

  const isLoading = reports === undefined;
  const isScheduledLoading = scheduledReports === undefined;

  // Show loading state while waiting for authentication or organization
  if (isSessionPending || (isAuthenticated && !isOrgReady)) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="reports-page-loading">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  // Show message if not authenticated
  if (!isAuthenticated) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="reports-page-unauthenticated">
        <Paper p="xl" ta="center" withBorder>
          <IconUser size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            Please sign in to continue
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be signed in to view reports.
          </Text>
          <Button component="a" href="/login" mt="md">
            Sign In
          </Button>
        </Paper>
      </Center>
    );
  }

  // Show message if user has no organization (skip in test mode)
  if (!IS_TEST_MODE && !isLoadingOrg && !activeOrganization) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="reports-page-no-org">
        <Paper p="xl" ta="center" withBorder>
          <IconCloud size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            No Organization Found
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be a member of an organization to view reports.
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <Container data-testid="reports-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Reports</Title>
            <Text c="dimmed" size="sm">
              Generate and view cost reports to share with stakeholders
            </Text>
          </Stack>
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconCalendarEvent size={16} />}
              onClick={openScheduleModal}
            >
              Schedule Report
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openGenerateModal}
            >
              Generate Report
            </Button>
          </Group>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconFilter size={16} />
                <Text fw={500}>Filters</Text>
              </Group>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconFilterOff size={14} />}
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
            </Group>

            <Group grow align="flex-start">
              <Box data-testid="type-filter">
                <MultiSelect
                  label="Report Type"
                  placeholder="All types"
                  data={typeOptions}
                  value={selectedTypes}
                  onChange={setSelectedTypes}
                  clearable
                  searchable
                />
              </Box>

              <Box data-testid="status-filter">
                <MultiSelect
                  label="Status"
                  placeholder="All statuses"
                  data={statusOptions}
                  value={selectedStatuses}
                  onChange={setSelectedStatuses}
                  clearable
                  searchable
                />
              </Box>
            </Group>
          </Stack>
        </Paper>

        {/* Reports List */}
        <Paper data-testid="reports-list" withBorder p="md">
          <Stack gap="md">
            <Group gap="xs">
              <IconFileText size={18} />
              <Title order={4}>Report History</Title>
            </Group>

            {isLoading ? (
              <Stack gap="sm">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={60} />
                ))}
              </Stack>
            ) : filteredReports.length === 0 ? (
              <Stack align="center" py="xl">
                <IconFileText size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No reports found.
                  {(selectedTypes.length > 0 || selectedStatuses.length > 0) && (
                    <>
                      <br />
                      Try adjusting your filters.
                    </>
                  )}
                </Text>
              </Stack>
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Format</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredReports.map((report) => (
                    <Table.Tr key={report._id} data-testid={`report-item-${report._id}`}>
                      <Table.Td>
                        <Text fw={500}>{report.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getTypeColor(report.type)} variant="light">
                          {report.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="outline"
                          leftSection={
                            report.format === "pdf" ? (
                              <IconFileTypePdf size={12} />
                            ) : (
                              <IconFileTypeCsv size={12} />
                            )
                          }
                        >
                          {report.format.toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Badge
                            data-testid={`status-badge-${report.status}`}
                            color={getStatusColor(report.status)}
                            variant="filled"
                            leftSection={getStatusIcon(report.status)}
                          >
                            {report.status}
                          </Badge>
                          {report.status === "failed" && report.errorMessage && (
                            <Tooltip 
                              label={parseErrorMessage(report.errorMessage).message}
                              multiline
                              w={200}
                            >
                              <Badge
                                size="xs"
                                variant="light"
                                color={getErrorColor(parseErrorMessage(report.errorMessage).category)}
                              >
                                {parseErrorMessage(report.errorMessage).category.replace("_", " ")}
                              </Badge>
                            </Tooltip>
                          )}
                          {report.status === "generating" && (
                            <Tooltip
                              label={
                                <Stack gap={4}>
                                  <Text size="xs" fw={500}>
                                    {report.progressMessage || "Generating..."}
                                  </Text>
                                  <Progress
                                    value={report.progressPercent || 0}
                                    size="xs"
                                    color="blue"
                                    animated
                                    w={150}
                                  />
                                  <Text size="xs" c="dimmed">
                                    {report.progressPercent || 0}% complete
                                  </Text>
                                </Stack>
                              }
                              multiline
                              w={180}
                            >
                              <Group gap={4}>
                                <RingProgress
                                  data-testid="generating-indicator"
                                  size={24}
                                  thickness={3}
                                  sections={[{ value: report.progressPercent || 0, color: "blue" }]}
                                />
                                <Text size="xs" c="dimmed">
                                  {report.progressPercent || 0}%
                                </Text>
                              </Group>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          data-testid={`report-timestamp-${report._id}`}
                          size="sm"
                          c="dimmed"
                        >
                          {formatRelativeTime(report.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {report.status === "completed" && (report.hasContent || report.hasReportData) && (
                            <Tooltip label="View report">
                              <ActionIcon
                                variant="light"
                                color="green"
                                onClick={() => handleViewReport(report._id)}
                                aria-label="View"
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {report.status === "completed" && report.downloadUrl && (
                            <Tooltip label="Download report">
                              <Anchor
                                href={report.downloadUrl}
                                target="_blank"
                                aria-label="Download"
                              >
                                <ActionIcon variant="light" color="blue">
                                  <IconDownload size={16} />
                                </ActionIcon>
                              </Anchor>
                            </Tooltip>
                          )}
                          {report.status === "failed" && (
                            <Tooltip 
                              label={
                                <Stack gap={4}>
                                  <Text size="xs" fw={500}>Click to view details</Text>
                                  <Text size="xs" c="dimmed" lineClamp={2}>
                                    {parseErrorMessage(report.errorMessage).message}
                                  </Text>
                                </Stack>
                              }
                              multiline
                              w={200}
                            >
                              <ActionIcon 
                                variant="light" 
                                color="red" 
                                aria-label="View error"
                                onClick={() => handleViewReport(report._id)}
                              >
                                <IconAlertCircle size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>

        {/* Scheduled Reports Section */}
        <Paper data-testid="scheduled-reports-section" withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconCalendarEvent size={18} />
                <Title order={4}>Scheduled Reports</Title>
              </Group>
            </Group>

            {isScheduledLoading ? (
              <Stack gap="sm">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={80} />
                ))}
              </Stack>
            ) : scheduledReports && scheduledReports.length === 0 ? (
              <Stack align="center" py="xl">
                <IconCalendarEvent size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No scheduled reports configured.
                  <br />
                  Schedule a report to automatically generate on a recurring basis.
                </Text>
              </Stack>
            ) : (
              <Stack gap="sm">
                {scheduledReports?.map((schedule) => (
                  <Card key={schedule._id} withBorder padding="sm" radius="md">
                    <Group justify="space-between" align="center">
                      <Stack gap={4}>
                        <Group gap="sm">
                          <Text fw={500}>{schedule.name}</Text>
                          <Badge color={getTypeColor(schedule.type)} variant="light" size="sm">
                            {schedule.type}
                          </Badge>
                          <Badge color={getScheduleColor(schedule.schedule)} variant="outline" size="sm">
                            {schedule.schedule}
                          </Badge>
                          <Badge
                            variant="outline"
                            size="sm"
                            leftSection={
                              schedule.format === "pdf" ? (
                                <IconFileTypePdf size={10} />
                              ) : (
                                <IconFileTypeCsv size={10} />
                              )
                            }
                          >
                            {schedule.format.toUpperCase()}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          Next run: {formatFutureTime(schedule.nextRun)}
                        </Text>
                      </Stack>
                      <Group gap="sm">
                        <Switch
                          checked={schedule.enabled}
                          onChange={(e) => handleToggleSchedule(schedule._id, e.currentTarget.checked)}
                          aria-label={schedule.enabled ? "Disable schedule" : "Enable schedule"}
                        />
                        <Tooltip label="Delete schedule">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteSchedule(schedule._id)}
                            aria-label="Delete"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>

      {/* Generate Report Modal */}
      <Modal
        opened={generateModalOpened}
        onClose={() => {
          closeGenerateModal();
          resetGenerateForm();
        }}
        title="Generate Report"
        size="md"
        data-testid="generate-report-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Report Name"
            placeholder="e.g., Monthly Cost Summary - January 2025"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            required
          />

          <Box data-testid="type-selector">
            <Text size="sm" fw={500} mb={4}>
              Report Type
            </Text>
            <Radio.Group
              value={reportType}
              onChange={(value) => setReportType(value as ReportType)}
            >
              <Stack gap="xs">
                <Radio value="summary" label="Summary" />
                <Radio value="detailed" label="Detailed" />
                <Radio value="recommendation" label="Recommendation" />
                <Radio value="comparison" label="Comparison" />
              </Stack>
            </Radio.Group>
          </Box>

          <Box data-testid="format-selector">
            <Text size="sm" fw={500} mb={4}>
              Output Format
            </Text>
            <Radio.Group
              value={reportFormat}
              onChange={(value) => setReportFormat(value as ReportFormat)}
            >
              <Group gap="xl">
                <Radio value="pdf" label="PDF" />
                <Radio value="csv" label="CSV" />
              </Group>
            </Radio.Group>
          </Box>

          <Box data-testid="aws-account-selector">
            <MultiSelect
              label="AWS Accounts"
              description="Select specific accounts to analyze, or leave empty to analyze all"
              placeholder={awsAccountOptions.length > 0 ? "All accounts" : "No accounts available"}
              data={awsAccountOptions}
              value={selectedAwsAccountIds}
              onChange={setSelectedAwsAccountIds}
              clearable
              searchable
              leftSection={<IconServer size={16} />}
              disabled={awsAccountOptions.length === 0}
            />
            {awsAccountOptions.length === 0 && (
              <Text size="xs" c="dimmed" mt={4}>
                No AWS accounts connected. Connect accounts in the AWS Accounts page first.
              </Text>
            )}
          </Box>

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeGenerateModal();
                resetGenerateForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={!reportName}>
              Generate
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Schedule Report Modal */}
      <Modal
        opened={scheduleModalOpened}
        onClose={() => {
          closeScheduleModal();
          resetScheduleForm();
        }}
        title="Schedule Report"
        size="md"
        data-testid="schedule-report-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Report Name"
            placeholder="e.g., Weekly Cost Summary"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            required
          />

          <Box>
            <Text size="sm" fw={500} mb={4}>
              Report Type
            </Text>
            <Radio.Group
              value={scheduleType}
              onChange={(value) => setScheduleType(value as ReportType)}
            >
              <Stack gap="xs">
                <Radio value="summary" label="Summary" />
                <Radio value="detailed" label="Detailed" />
                <Radio value="recommendation" label="Recommendation" />
                <Radio value="comparison" label="Comparison" />
              </Stack>
            </Radio.Group>
          </Box>

          <Box>
            <Text size="sm" fw={500} mb={4}>
              Output Format
            </Text>
            <Radio.Group
              value={scheduleFormat}
              onChange={(value) => setScheduleFormat(value as ReportFormat)}
            >
              <Group gap="xl">
                <Radio value="pdf" label="PDF" />
                <Radio value="csv" label="CSV" />
              </Group>
            </Radio.Group>
          </Box>

          <Box data-testid="schedule-selector">
            <Text size="sm" fw={500} mb={4}>
              Schedule Frequency
            </Text>
            <Radio.Group
              value={scheduleFrequency}
              onChange={(value) => setScheduleFrequency(value as ScheduleFrequency)}
            >
              <Stack gap="xs">
                <Radio value="daily" label="Daily" />
                <Radio value="weekly" label="Weekly" />
                <Radio value="monthly" label="Monthly" />
                <Radio value="quarterly" label="Quarterly" />
              </Stack>
            </Radio.Group>
          </Box>

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeScheduleModal();
                resetScheduleForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSchedule} disabled={!scheduleName}>
              Create Schedule
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        opened={detailModalOpened}
        onClose={handleCloseDetailModal}
        title={reportDetail?.name || "Report Details"}
        size="xl"
        data-testid="report-detail-modal"
      >
        {!reportDetail ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : reportDetail.status === "failed" ? (
          (() => {
            const parsedError = parseErrorMessage(reportDetail.errorMessage);
            return (
              <Stack gap="lg" py="md">
                {/* Error Header */}
                <Card withBorder p="lg" radius="md" bg="red.0">
                  <Group gap="md" align="flex-start">
                    <ThemeIcon size="xl" radius="xl" color={getErrorColor(parsedError.category)} variant="light">
                      {getErrorIcon(parsedError.category)}
                    </ThemeIcon>
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={600} size="lg" c="red.7">
                        {parsedError.message}
                      </Text>
                      <Badge 
                        size="sm" 
                        variant="outline" 
                        color={getErrorColor(parsedError.category)}
                      >
                        {parsedError.category.replace("_", " ").toUpperCase()}
                      </Badge>
                    </Stack>
                  </Group>
                </Card>

                {/* Error Details */}
                {parsedError.details && (
                  <Card withBorder p="md" radius="md">
                    <Group gap="xs" mb="xs">
                      <IconInfoCircle size={16} style={{ opacity: 0.7 }} />
                      <Text size="sm" fw={500} c="dimmed">Error Details</Text>
                    </Group>
                    <Text size="sm">
                      {parsedError.details}
                    </Text>
                  </Card>
                )}

                {/* Suggestion */}
                {parsedError.suggestion && (
                  <Card withBorder p="md" radius="md" bg="blue.0">
                    <Group gap="xs" mb="xs">
                      <IconInfoCircle size={16} color="var(--mantine-color-blue-6)" />
                      <Text size="sm" fw={500} c="blue.7">Suggested Action</Text>
                    </Group>
                    <Text size="sm" c="blue.9">
                      {parsedError.suggestion}
                    </Text>
                  </Card>
                )}

                {/* Quick Actions based on error type */}
                {parsedError.category === "configuration" && (
                  <Card withBorder p="md" radius="md" bg="orange.0">
                    <Stack gap="xs">
                      <Text size="sm" fw={500} c="orange.7">Configuration Required</Text>
                      <Text size="sm" c="dimmed">
                        The AI service API key needs to be configured in your Convex dashboard.
                      </Text>
                      <Button
                        component="a"
                        href="https://dashboard.convex.dev"
                        target="_blank"
                        variant="light"
                        color="orange"
                        size="sm"
                        leftSection={<IconKey size={14} />}
                        mt="xs"
                      >
                        Open Convex Dashboard
                      </Button>
                    </Stack>
                  </Card>
                )}

                {parsedError.category === "no_accounts" && (
                  <Card withBorder p="md" radius="md" bg="yellow.0">
                    <Stack gap="xs">
                      <Text size="sm" fw={500} c="yellow.8">No AWS Accounts Connected</Text>
                      <Text size="sm" c="dimmed">
                        You need to connect at least one AWS account before generating reports.
                      </Text>
                      <Button
                        component="a"
                        href="/aws-accounts"
                        variant="light"
                        color="yellow"
                        size="sm"
                        leftSection={<IconCloud size={14} />}
                        mt="xs"
                      >
                        Go to AWS Accounts
                      </Button>
                    </Stack>
                  </Card>
                )}

                <Divider />

                {/* Actions */}
                <Group justify="flex-end" gap="sm">
                  <Button variant="subtle" onClick={handleCloseDetailModal}>
                    Close
                  </Button>
                  <Button
                    variant="light"
                    color="blue"
                    leftSection={<IconRefresh size={16} />}
                    onClick={() => {
                      handleCloseDetailModal();
                      openGenerateModal();
                    }}
                  >
                    Try Again
                  </Button>
                </Group>
              </Stack>
            );
          })()
        ) : reportDetail.status === "generating" || reportDetail.status === "pending" ? (
          <Stack align="center" py="xl" gap="lg">
            {/* Progress Ring */}
            <RingProgress
              size={120}
              thickness={8}
              roundCaps
              sections={[{ value: reportDetail.progressPercent || 0, color: "blue" }]}
              label={
                <Center>
                  <Text size="lg" fw={700} c="blue">
                    {reportDetail.progressPercent || 0}%
                  </Text>
                </Center>
              }
            />
            
            {/* Progress Text */}
            <Stack align="center" gap="xs">
              <Text fw={600} size="lg">
                {reportDetail.progressMessage || "Generating Report..."}
              </Text>
              <Text c="dimmed" size="sm">
                Step {reportDetail.progressStep || 1} of 5
              </Text>
            </Stack>

            {/* Progress Bar */}
            <Box w="100%" maw={400}>
              <Progress
                value={reportDetail.progressPercent || 0}
                size="lg"
                radius="xl"
                color="blue"
                animated
                striped
              />
              <Text ta="center" size="sm" c="dimmed" mt="xs">
                {reportDetail.progressPercent || 0}% complete
              </Text>
            </Box>

            {/* Step Indicators */}
            <Group gap="xs" mt="md">
              {[1, 2, 3, 4, 5].map((step) => (
                <Tooltip
                  key={step}
                  label={
                    step === 1 ? "Initializing" :
                    step === 2 ? "Fetching accounts" :
                    step === 3 ? "Preparing analysis" :
                    step === 4 ? "AI analysis" :
                    "Finalizing"
                  }
                >
                  <ThemeIcon
                    size="sm"
                    radius="xl"
                    color={step <= (reportDetail.progressStep || 1) ? "blue" : "gray"}
                    variant={step === reportDetail.progressStep ? "filled" : "light"}
                  >
                    {step <= (reportDetail.progressStep || 1) ? (
                      step < (reportDetail.progressStep || 1) ? (
                        <IconCheck size={12} />
                      ) : (
                        <Text size="xs" fw={600}>{step}</Text>
                      )
                    ) : (
                      <Text size="xs">{step}</Text>
                    )}
                  </ThemeIcon>
                </Tooltip>
              ))}
            </Group>

            <Text c="dimmed" ta="center" size="sm" mt="md">
              The AI agent is analyzing your AWS accounts and generating the report.
              This may take a few minutes.
            </Text>
          </Stack>
        ) : reportDetail.content || reportDetail.reportData ? (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Badge color={getTypeColor(reportDetail.type)} variant="light">
                  {reportDetail.type}
                </Badge>
                {reportDetail.completedAt && (
                  <Text size="xs" c="dimmed">
                    Generated {formatRelativeTime(reportDetail.completedAt)}
                  </Text>
                )}
              </Group>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconFileExport size={16} />}
                onClick={handleExportPdf}
                loading={isExportingPdf}
                size="sm"
              >
                Export PDF
              </Button>
            </Group>
            <Divider />
            {reportDetail.reportData ? (
              <Stack gap="sm">
                <Text fw={600}>Cost Analysis Report</Text>
                <Text size="sm" c="dimmed">
                  This is a structured cost analysis report. Click "Export PDF" to download the full report with charts and tables.
                </Text>
              </Stack>
            ) : (
              <ScrollArea h={500} type="auto">
                <TypographyStylesProvider>
                  <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
                </TypographyStylesProvider>
              </ScrollArea>
            )}
          </Stack>
        ) : (
          <Stack align="center" py="xl">
            <IconFileText size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed">No content available for this report.</Text>
          </Stack>
        )}
      </Modal>
    </Container>
  );
});

export default ReportsPage;
