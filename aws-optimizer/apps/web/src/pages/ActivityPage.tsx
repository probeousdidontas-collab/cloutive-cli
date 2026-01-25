import { useState, useCallback, useMemo } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  Table,
  Badge,
  Skeleton,
  ActionIcon,
  Tooltip,
  Pagination,
  Card,
  ThemeIcon,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconActivity,
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconUser,
  IconBuilding,
  IconCloud,
  IconWallet,
  IconFileText,
  IconMail,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  activityLogs: {
    list: "api.activityLogs.list",
    getUsers: "api.activityLogs.getUsers",
  },
};

// TODO: In production, get these from auth context
// For now, these will be passed as props or from a context
const PLACEHOLDER_ORG_ID = undefined;
const PLACEHOLDER_USER_ID = undefined;

interface ActivityLog {
  _id: string;
  organizationId: string;
  userId: string;
  action: "create" | "update" | "delete";
  entityType: "organization" | "aws_account" | "budget" | "report" | "invitation";
  entityId: string;
  details?: {
    previousValues?: unknown;
    newValues?: unknown;
    description?: string;
  };
  createdAt: number;
  user?: {
    _id: string;
    name: string;
    email: string;
  } | null;
}

interface ActivityUser {
  _id: string;
  name: string;
  email: string;
}

const ACTION_OPTIONS = [
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "organization", label: "Organization" },
  { value: "aws_account", label: "AWS Account" },
  { value: "budget", label: "Budget" },
  { value: "report", label: "Report" },
  { value: "invitation", label: "Invitation" },
];

const ITEMS_PER_PAGE = 20;

function getActionIcon(action: string) {
  switch (action) {
    case "create":
      return <IconPlus size={14} />;
    case "update":
      return <IconEdit size={14} />;
    case "delete":
      return <IconTrash size={14} />;
    default:
      return <IconActivity size={14} />;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case "create":
      return "green";
    case "update":
      return "blue";
    case "delete":
      return "red";
    default:
      return "gray";
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "organization":
      return <IconBuilding size={16} />;
    case "aws_account":
      return <IconCloud size={16} />;
    case "budget":
      return <IconWallet size={16} />;
    case "report":
      return <IconFileText size={16} />;
    case "invitation":
      return <IconMail size={16} />;
    default:
      return <IconActivity size={16} />;
  }
}

function formatEntityType(entityType: string): string {
  return entityType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  return "Just now";
}

export function ActivityPage() {
  // Filter state
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterEntityType, setFilterEntityType] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [page, setPage] = useState(1);

  // Convert date range to timestamps
  const startDate = dateRange[0] ? dateRange[0].getTime() : undefined;
  const endDate = dateRange[1] ? dateRange[1].getTime() + 24 * 60 * 60 * 1000 : undefined; // End of day

  // Fetch activity logs
  // Note: organizationId and userId should come from auth context in production
  const logsResult = useQuery(
    api.activityLogs.list,
    PLACEHOLDER_ORG_ID && PLACEHOLDER_USER_ID
      ? {
          organizationId: PLACEHOLDER_ORG_ID,
          userId: PLACEHOLDER_USER_ID,
          filterUserId: filterUserId || undefined,
          action: filterAction || undefined,
          entityType: filterEntityType || undefined,
          startDate,
          endDate,
          limit: ITEMS_PER_PAGE * page,
        }
      : "skip"
  ) as { logs: ActivityLog[]; hasMore: boolean } | undefined;

  // Fetch users for filter dropdown
  const users = useQuery(
    api.activityLogs.getUsers,
    PLACEHOLDER_ORG_ID && PLACEHOLDER_USER_ID
      ? {
          organizationId: PLACEHOLDER_ORG_ID,
          userId: PLACEHOLDER_USER_ID,
        }
      : "skip"
  ) as ActivityUser[] | undefined;

  // User options for dropdown
  const userOptions = useMemo(() => {
    if (!users) return [];
    return users.map((user) => ({
      value: user._id,
      label: user.name,
    }));
  }, [users]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    if (!logsResult?.logs) return [];
    const start = (page - 1) * ITEMS_PER_PAGE;
    return logsResult.logs.slice(start, start + ITEMS_PER_PAGE);
  }, [logsResult?.logs, page]);

  // Total pages
  const totalPages = useMemo(() => {
    if (!logsResult?.logs) return 1;
    return Math.ceil(logsResult.logs.length / ITEMS_PER_PAGE);
  }, [logsResult?.logs]);

  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    setFilterUserId(null);
    setFilterAction(null);
    setFilterEntityType(null);
    setDateRange([null, null]);
    setPage(1);
  }, []);

  const isLoading = logsResult === undefined;

  return (
    <Container data-testid="activity-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Activity Log</Title>
            <Text c="dimmed" size="sm">
              View all actions taken in your organization
            </Text>
          </Stack>
          <Tooltip label="Reset Filters">
            <ActionIcon
              data-testid="reset-filters-button"
              variant="light"
              onClick={handleResetFilters}
              size="lg"
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Filters */}
        <Paper data-testid="filters-section" withBorder p="md">
          <Group grow align="flex-end">
            <Select
              data-testid="user-filter"
              label="User"
              placeholder="All users"
              data={userOptions}
              value={filterUserId}
              onChange={(value) => {
                setFilterUserId(value);
                setPage(1);
              }}
              clearable
              searchable
            />
            <Select
              data-testid="action-filter"
              label="Action"
              placeholder="All actions"
              data={ACTION_OPTIONS}
              value={filterAction}
              onChange={(value) => {
                setFilterAction(value);
                setPage(1);
              }}
              clearable
            />
            <Select
              data-testid="entity-type-filter"
              label="Entity Type"
              placeholder="All types"
              data={ENTITY_TYPE_OPTIONS}
              value={filterEntityType}
              onChange={(value) => {
                setFilterEntityType(value);
                setPage(1);
              }}
              clearable
            />
            <DatePickerInput
              data-testid="date-range-filter"
              type="range"
              label="Date Range"
              placeholder="Select date range"
              value={dateRange}
              onChange={(value) => {
                setDateRange(value);
                setPage(1);
              }}
              clearable
            />
          </Group>
        </Paper>

        {/* Activity Table */}
        <Paper data-testid="activity-table" withBorder>
          {isLoading ? (
            <Stack p="md" gap="sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={60} />
              ))}
            </Stack>
          ) : paginatedLogs.length === 0 ? (
            <Card p="xl" style={{ textAlign: "center" }}>
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <IconActivity size={24} />
                </ThemeIcon>
                <Text c="dimmed">No activity logs found</Text>
                <Text size="sm" c="dimmed">
                  Activity will appear here when actions are taken in your organization
                </Text>
              </Stack>
            </Card>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Entity</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Details</Table.Th>
                  <Table.Th>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedLogs.map((log) => (
                  <Table.Tr key={log._id} data-testid={`activity-row-${log._id}`}>
                    <Table.Td>
                      <Badge
                        leftSection={getActionIcon(log.action)}
                        color={getActionColor(log.action)}
                        variant="light"
                      >
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="gray">
                          {getEntityIcon(log.entityType)}
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="sm" fw={500}>
                            {formatEntityType(log.entityType)}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                            {log.entityId.length > 20
                              ? `${log.entityId.slice(0, 20)}...`
                              : log.entityId}
                          </Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="blue">
                          <IconUser size={14} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="sm">{log.user?.name || "Unknown"}</Text>
                          <Text size="xs" c="dimmed">
                            {log.user?.email || ""}
                          </Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {log.details?.description || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={new Date(log.createdAt).toLocaleString()}>
                        <Text size="sm" c="dimmed">
                          {formatTimeAgo(log.createdAt)}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <Group justify="center">
            <Pagination
              data-testid="pagination"
              total={totalPages}
              value={page}
              onChange={setPage}
            />
          </Group>
        )}

        {/* Info about retention */}
        <Text size="xs" c="dimmed" ta="center">
          Activity logs are retained for 90 days
        </Text>
      </Stack>
    </Container>
  );
}

export default ActivityPage;
