import { useState, useMemo } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Skeleton,
  Tabs,
  Card,
  ActionIcon,
  Tooltip,
  Select,
  Modal,
  Image,
  ScrollArea,
  Divider,
  Box,
  ThemeIcon,
  Switch,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { EmptyState } from "../components/ui";
import {
  IconBug,
  IconMessagePlus,
  IconArchive,
  IconEye,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { showSuccessToast, showErrorToast } from "../lib/notifications";
import { CopyAiPromptButton } from "../components/CopyAiPromptButton";

type BugSeverity = "low" | "medium" | "high" | "critical";
type BugStatus = "open" | "in-progress" | "resolved" | "closed";
type FeedbackType = "feature_request" | "change_request" | "general";
type FeedbackPriority = "nice_to_have" | "important" | "critical";
type FeedbackStatus = "open" | "under_review" | "planned" | "in_progress" | "completed" | "declined";

function getSeverityColor(severity: BugSeverity): string {
  const colors: Record<BugSeverity, string> = {
    critical: "red",
    high: "orange",
    medium: "yellow",
    low: "blue",
  };
  return colors[severity] || "gray";
}

function getSeverityIcon(severity: BugSeverity) {
  const icons: Record<BugSeverity, React.ReactNode> = {
    critical: <IconAlertCircle size={16} />,
    high: <IconAlertTriangle size={16} />,
    medium: <IconInfoCircle size={16} />,
    low: <IconInfoCircle size={16} />,
  };
  return icons[severity] || <IconBug size={16} />;
}

function getBugStatusColor(status: BugStatus): string {
  const colors: Record<BugStatus, string> = {
    open: "blue",
    "in-progress": "yellow",
    resolved: "green",
    closed: "gray",
  };
  return colors[status] || "gray";
}

function getFeedbackTypeColor(type: FeedbackType): string {
  const colors: Record<FeedbackType, string> = {
    feature_request: "violet",
    change_request: "cyan",
    general: "gray",
  };
  return colors[type] || "gray";
}

function getFeedbackTypeLabel(type: FeedbackType): string {
  const labels: Record<FeedbackType, string> = {
    feature_request: "Feature Request",
    change_request: "Change Request",
    general: "General",
  };
  return labels[type] || type;
}

function getPriorityColor(priority: FeedbackPriority): string {
  const colors: Record<FeedbackPriority, string> = {
    critical: "red",
    important: "orange",
    nice_to_have: "blue",
  };
  return colors[priority] || "gray";
}

function getPriorityLabel(priority: FeedbackPriority): string {
  const labels: Record<FeedbackPriority, string> = {
    critical: "Critical",
    important: "Important",
    nice_to_have: "Nice to Have",
  };
  return labels[priority] || priority;
}

function getFeedbackStatusColor(status: FeedbackStatus): string {
  const colors: Record<FeedbackStatus, string> = {
    open: "blue",
    under_review: "cyan",
    planned: "violet",
    in_progress: "yellow",
    completed: "green",
    declined: "red",
  };
  return colors[status] || "gray";
}

function getFeedbackStatusLabel(status: FeedbackStatus): string {
  const labels: Record<FeedbackStatus, string> = {
    open: "Open",
    under_review: "Under Review",
    planned: "Planned",
    in_progress: "In Progress",
    completed: "Completed",
    declined: "Declined",
  };
  return labels[status] || status;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface BugReport {
  _id: string;
  ticketNumber?: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  reporterName: string;
  reporterEmail: string;
  url: string;
  browserInfo: string;
  consoleErrors?: string;
  screenshotStorageId?: string;
  createdAt: number;
  isArchived?: boolean;
  aiSummary?: string;
  aiRootCauseAnalysis?: string;
  aiSuggestedFix?: string;
}

interface FeedbackItem {
  _id: string;
  ticketNumber?: string;
  type: FeedbackType;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  reporterName: string;
  reporterEmail: string;
  url: string;
  screenshotStorageId?: string;
  createdAt: number;
  isArchived?: boolean;
  aiSummary?: string;
  aiImpactAnalysis?: string;
  aiActionItems?: string[];
}

function BugReportCard({ bug, onView }: { bug: BugReport; onView: () => void }) {
  const updateStatus = useMutation(api.feedback.updateBugReportStatus);
  const archiveBug = useMutation(api.feedback.archiveBugReport);

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return;
    try {
      await updateStatus({ reportId: bug._id, status: newStatus as BugStatus });
      showSuccessToast("Status updated");
    } catch {
      showErrorToast("Failed to update status");
    }
  };

  const handleArchive = async () => {
    try {
      await archiveBug({ reportId: bug._id });
      showSuccessToast("Bug report archived");
    } catch {
      showErrorToast("Failed to archive");
    }
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" color={getSeverityColor(bug.severity)} variant="light">
            {getSeverityIcon(bug.severity)}
          </ThemeIcon>
          <Text fw={500} size="sm" lineClamp={1} style={{ maxWidth: 300 }}>
            {bug.ticketNumber && (
              <Text span c="dimmed" size="xs" mr="xs">
                {bug.ticketNumber}
              </Text>
            )}
            {bug.title}
          </Text>
        </Group>
        <Group gap="xs">
          {bug.isArchived && (
            <Badge size="sm" color="gray" variant="outline">Archived</Badge>
          )}
          <Badge size="sm" color={getSeverityColor(bug.severity)}>
            {bug.severity}
          </Badge>
          <Badge size="sm" color={getBugStatusColor(bug.status)}>
            {bug.status}
          </Badge>
        </Group>
      </Group>

      <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
        {bug.description}
      </Text>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {bug.reporterName} - {formatRelativeTime(bug.createdAt)}
        </Text>
        <Group gap="xs">
          <Select
            size="xs"
            placeholder="Status"
            value={bug.status}
            onChange={handleStatusChange}
            data={[
              { value: "open", label: "Open" },
              { value: "in-progress", label: "In Progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ]}
            w={120}
          />
          <Tooltip label="View details">
            <ActionIcon variant="subtle" onClick={onView}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <CopyAiPromptButton type="bug" report={bug} />
          <Tooltip label="Archive">
            <ActionIcon variant="subtle" color="red" onClick={handleArchive}>
              <IconArchive size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}

function FeedbackCard({ feedback, onView }: { feedback: FeedbackItem; onView: () => void }) {
  const updateStatus = useMutation(api.feedback.updateFeedbackStatus);
  const archiveFeedback = useMutation(api.feedback.archiveFeedback);

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return;
    try {
      await updateStatus({ feedbackId: feedback._id, status: newStatus as FeedbackStatus });
      showSuccessToast("Status updated");
    } catch {
      showErrorToast("Failed to update status");
    }
  };

  const handleArchive = async () => {
    try {
      await archiveFeedback({ feedbackId: feedback._id });
      showSuccessToast("Feedback archived");
    } catch {
      showErrorToast("Failed to archive");
    }
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" color={getFeedbackTypeColor(feedback.type)} variant="light">
            <IconMessagePlus size={16} />
          </ThemeIcon>
          <Text fw={500} size="sm" lineClamp={1} style={{ maxWidth: 300 }}>
            {feedback.ticketNumber && (
              <Text span c="dimmed" size="xs" mr="xs">
                {feedback.ticketNumber}
              </Text>
            )}
            {feedback.title}
          </Text>
        </Group>
        <Group gap="xs">
          {feedback.isArchived && (
            <Badge size="sm" color="gray" variant="outline">Archived</Badge>
          )}
          <Badge size="sm" color={getFeedbackTypeColor(feedback.type)}>
            {getFeedbackTypeLabel(feedback.type)}
          </Badge>
          <Badge size="sm" color={getPriorityColor(feedback.priority)}>
            {getPriorityLabel(feedback.priority)}
          </Badge>
        </Group>
      </Group>

      <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
        {feedback.description}
      </Text>

      <Group justify="space-between">
        <Group gap="xs">
          <Badge size="xs" color={getFeedbackStatusColor(feedback.status)} variant="outline">
            {getFeedbackStatusLabel(feedback.status)}
          </Badge>
          <Text size="xs" c="dimmed">
            {feedback.reporterName} - {formatRelativeTime(feedback.createdAt)}
          </Text>
        </Group>
        <Group gap="xs">
          <Select
            size="xs"
            placeholder="Status"
            value={feedback.status}
            onChange={handleStatusChange}
            data={[
              { value: "open", label: "Open" },
              { value: "under_review", label: "Under Review" },
              { value: "planned", label: "Planned" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "declined", label: "Declined" },
            ]}
            w={130}
          />
          <Tooltip label="View details">
            <ActionIcon variant="subtle" onClick={onView}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Archive">
            <ActionIcon variant="subtle" color="red" onClick={handleArchive}>
              <IconArchive size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}

function BugDetailModal({
  bug,
  opened,
  onClose,
}: {
  bug: BugReport | null;
  opened: boolean;
  onClose: () => void;
}) {
  const screenshotUrl = useQuery(
    api.feedback.getBugReportScreenshotUrl,
    bug?.screenshotStorageId ? { storageId: bug.screenshotStorageId } : "skip"
  );

  if (!bug) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={bug.title} size="lg">
      <Stack gap="md">
        <Group gap="xs">
          <Badge color={getSeverityColor(bug.severity)}>{bug.severity}</Badge>
          <Badge color={getBugStatusColor(bug.status)}>{bug.status}</Badge>
          {bug.ticketNumber && <Badge variant="outline">{bug.ticketNumber}</Badge>}
          <CopyAiPromptButton type="bug" report={bug} />
        </Group>

        <Box>
          <Text size="sm" fw={500} mb="xs">Description</Text>
          <Text size="sm" c="dimmed">{bug.description}</Text>
        </Box>

        {bug.aiSummary && (
          <Box>
            <Text size="sm" fw={500} mb="xs">AI Summary</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Text size="sm">{bug.aiSummary}</Text>
            </Paper>
          </Box>
        )}

        {bug.aiRootCauseAnalysis && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Root Cause Analysis</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Text size="sm">{bug.aiRootCauseAnalysis}</Text>
            </Paper>
          </Box>
        )}

        {bug.aiSuggestedFix && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Suggested Fix</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Text size="sm">{bug.aiSuggestedFix}</Text>
            </Paper>
          </Box>
        )}

        {screenshotUrl && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Screenshot</Text>
            <Image src={screenshotUrl} alt="Bug screenshot" radius="md" />
          </Box>
        )}

        <Divider />

        <Group gap="lg">
          <Box>
            <Text size="xs" c="dimmed">Reporter</Text>
            <Text size="sm">{bug.reporterName}</Text>
            <Text size="xs" c="dimmed">{bug.reporterEmail}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">URL</Text>
            <Text size="sm" lineClamp={1}>{bug.url}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">Submitted</Text>
            <Text size="sm">{new Date(bug.createdAt).toLocaleString()}</Text>
          </Box>
        </Group>

        {bug.consoleErrors && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Console Errors</Text>
            <ScrollArea h={100}>
              <Paper p="sm" withBorder bg="dark.9">
                <Text size="xs" ff="monospace" c="red.4">
                  {bug.consoleErrors}
                </Text>
              </Paper>
            </ScrollArea>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}

function FeedbackDetailModal({
  feedback,
  opened,
  onClose,
}: {
  feedback: FeedbackItem | null;
  opened: boolean;
  onClose: () => void;
}) {
  const screenshotUrl = useQuery(
    api.feedback.getFeedbackScreenshotUrl,
    feedback?.screenshotStorageId ? { storageId: feedback.screenshotStorageId } : "skip"
  );

  if (!feedback) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={feedback.title} size="lg">
      <Stack gap="md">
        <Group gap="xs">
          <Badge color={getFeedbackTypeColor(feedback.type)}>
            {getFeedbackTypeLabel(feedback.type)}
          </Badge>
          <Badge color={getPriorityColor(feedback.priority)}>
            {getPriorityLabel(feedback.priority)}
          </Badge>
          <Badge color={getFeedbackStatusColor(feedback.status)}>
            {getFeedbackStatusLabel(feedback.status)}
          </Badge>
          {feedback.ticketNumber && <Badge variant="outline">{feedback.ticketNumber}</Badge>}
        </Group>

        <Box>
          <Text size="sm" fw={500} mb="xs">Description</Text>
          <Text size="sm" c="dimmed">{feedback.description}</Text>
        </Box>

        {feedback.aiSummary && (
          <Box>
            <Text size="sm" fw={500} mb="xs">AI Summary</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Text size="sm">{feedback.aiSummary}</Text>
            </Paper>
          </Box>
        )}

        {feedback.aiImpactAnalysis && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Impact Analysis</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Text size="sm">{feedback.aiImpactAnalysis}</Text>
            </Paper>
          </Box>
        )}

        {feedback.aiActionItems && feedback.aiActionItems.length > 0 && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Action Items</Text>
            <Paper p="sm" withBorder bg="gray.0">
              <Stack gap="xs">
                {feedback.aiActionItems.map((item, i) => (
                  <Group key={i} gap="xs">
                    <IconCircleCheck size={14} />
                    <Text size="sm">{item}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </Box>
        )}

        {screenshotUrl && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Screenshot</Text>
            <Image src={screenshotUrl} alt="Feedback screenshot" radius="md" />
          </Box>
        )}

        <Divider />

        <Group gap="lg">
          <Box>
            <Text size="xs" c="dimmed">Reporter</Text>
            <Text size="sm">{feedback.reporterName}</Text>
            <Text size="xs" c="dimmed">{feedback.reporterEmail}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">URL</Text>
            <Text size="sm" lineClamp={1}>{feedback.url}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">Submitted</Text>
            <Text size="sm">{new Date(feedback.createdAt).toLocaleString()}</Text>
          </Box>
        </Group>
      </Stack>
    </Modal>
  );
}

export function FeedbackAdminPage() {
  const [activeTab, setActiveTab] = useState<string | null>("bugs");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [bugModalOpened, bugModalHandlers] = useDisclosure(false);
  const [feedbackModalOpened, feedbackModalHandlers] = useDisclosure(false);

  const bugReports = useQuery(api.feedback.listBugReports, { includeArchived: showArchived }) as BugReport[] | undefined;
  const feedbackItems = useQuery(api.feedback.listFeedback, { includeArchived: showArchived }) as FeedbackItem[] | undefined;

  const isLoading = bugReports === undefined || feedbackItems === undefined;

  const stats = useMemo(() => {
    const openBugs = bugReports?.filter((b) => b.status === "open").length ?? 0;
    const criticalBugs = bugReports?.filter((b) => b.severity === "critical").length ?? 0;
    const openFeedback = feedbackItems?.filter((f) => f.status === "open").length ?? 0;
    const totalBugs = bugReports?.length ?? 0;
    const totalFeedback = feedbackItems?.length ?? 0;

    return { openBugs, criticalBugs, openFeedback, totalBugs, totalFeedback };
  }, [bugReports, feedbackItems]);

  const handleViewBug = (bug: BugReport) => {
    setSelectedBug(bug);
    bugModalHandlers.open();
  };

  const handleViewFeedback = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    feedbackModalHandlers.open();
  };

  return (
    <Container size="lg" py="md">
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Title order={2}>Feedback Admin</Title>
            <Text c="dimmed" size="sm">
              Manage bug reports and user feedback
            </Text>
          </div>
          <Switch
            label="Show archived"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.currentTarget.checked)}
          />
        </Group>

        {/* Stats */}
        <Group gap="md">
          <Paper p="md" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon size="lg" color="red" variant="light">
                <IconBug size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Open Bugs</Text>
                <Text fw={700}>{stats.openBugs}</Text>
              </div>
            </Group>
          </Paper>
          <Paper p="md" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon size="lg" color="orange" variant="light">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Critical</Text>
                <Text fw={700}>{stats.criticalBugs}</Text>
              </div>
            </Group>
          </Paper>
          <Paper p="md" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon size="lg" color="blue" variant="light">
                <IconMessagePlus size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Open Feedback</Text>
                <Text fw={700}>{stats.openFeedback}</Text>
              </div>
            </Group>
          </Paper>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="bugs" leftSection={<IconBug size={16} />}>
              Bug Reports ({stats.totalBugs})
            </Tabs.Tab>
            <Tabs.Tab value="feedback" leftSection={<IconMessagePlus size={16} />}>
              Feedback ({stats.totalFeedback})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="bugs" pt="md">
            {isLoading ? (
              <Stack gap="md">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={100} radius="md" />
                ))}
              </Stack>
            ) : bugReports && bugReports.length > 0 ? (
              <Stack gap="md">
                {bugReports.map((bug) => (
                  <BugReportCard
                    key={bug._id}
                    bug={bug}
                    onView={() => handleViewBug(bug)}
                  />
                ))}
              </Stack>
            ) : (
              <EmptyState
                title="No bug reports"
                description="Bug reports submitted by users will appear here."
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="feedback" pt="md">
            {isLoading ? (
              <Stack gap="md">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={100} radius="md" />
                ))}
              </Stack>
            ) : feedbackItems && feedbackItems.length > 0 ? (
              <Stack gap="md">
                {feedbackItems.map((feedback) => (
                  <FeedbackCard
                    key={feedback._id}
                    feedback={feedback}
                    onView={() => handleViewFeedback(feedback)}
                  />
                ))}
              </Stack>
            ) : (
              <EmptyState
                title="No feedback"
                description="User feedback and feature requests will appear here."
              />
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <BugDetailModal
        bug={selectedBug}
        opened={bugModalOpened}
        onClose={bugModalHandlers.close}
      />

      <FeedbackDetailModal
        feedback={selectedFeedback}
        opened={feedbackModalOpened}
        onClose={feedbackModalHandlers.close}
      />
    </Container>
  );
}
