import { useState, useMemo, useCallback } from "react";
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
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  reports: {
    list: "api.reports.list",
    generate: "api.reports.generate",
    listScheduled: "api.reports.listScheduled",
    createSchedule: "api.reports.createSchedule",
    deleteSchedule: "api.reports.deleteSchedule",
    toggleSchedule: "api.reports.toggleSchedule",
  },
};

type ReportType = "summary" | "detailed" | "recommendation" | "comparison";
type ReportFormat = "pdf" | "csv";
type ReportStatus = "pending" | "generating" | "completed" | "failed";
type ScheduleFrequency = "daily" | "weekly" | "monthly" | "quarterly";

interface Report {
  _id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  downloadUrl: string | null;
  createdAt: number;
  completedAt: number | null;
  error?: string;
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

export function ReportsPage() {
  // Modal states
  const [generateModalOpened, { open: openGenerateModal, close: closeGenerateModal }] = useDisclosure(false);
  const [scheduleModalOpened, { open: openScheduleModal, close: closeScheduleModal }] = useDisclosure(false);

  // Form states for generate modal
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("pdf");

  // Form states for schedule modal
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleType, setScheduleType] = useState<ReportType>("summary");
  const [scheduleFormat, setScheduleFormat] = useState<ReportFormat>("pdf");
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>("weekly");

  // Filter states
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Fetch data
  const reports = useQuery(api.reports.list) as Report[] | undefined;
  const scheduledReports = useQuery(api.reports.listScheduled) as ScheduledReport[] | undefined;

  // Mutations
  const generateReport = useMutation(api.reports.generate);
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

  // Reset generate form
  const resetGenerateForm = useCallback(() => {
    setReportName("");
    setReportType("summary");
    setReportFormat("pdf");
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
    await generateReport({
      name: reportName,
      type: reportType,
      format: reportFormat,
    });
    closeGenerateModal();
    resetGenerateForm();
  }, [reportName, reportType, reportFormat, generateReport, closeGenerateModal, resetGenerateForm]);

  // Handle create schedule
  const handleCreateSchedule = useCallback(async () => {
    await createSchedule({
      name: scheduleName,
      type: scheduleType,
      format: scheduleFormat,
      schedule: scheduleFrequency,
    });
    closeScheduleModal();
    resetScheduleForm();
  }, [scheduleName, scheduleType, scheduleFormat, scheduleFrequency, createSchedule, closeScheduleModal, resetScheduleForm]);

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
                          {report.status === "generating" && (
                            <Loader data-testid="generating-indicator" size="xs" />
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
    </Container>
  );
}

export default ReportsPage;
