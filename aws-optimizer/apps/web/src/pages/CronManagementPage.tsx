/**
 * Cron Management Page
 *
 * Full CRUD management UI for table-driven cron schedules.
 * List all jobs, toggle enable/disable, edit schedules,
 * view run history, and trigger manual runs.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Skeleton,
  Paper,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Textarea,
  Switch,
  Button,
  Table,
  Code,
  Select,
  SimpleGrid,
  ThemeIcon,
  Box,
  SegmentedControl,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconClock,
  IconPlayerPlay,
  IconEdit,
  IconHistory,
  IconTrash,
  IconPlus,
  IconAlertTriangle,
  IconCalendar,
  IconCode,
} from "@tabler/icons-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { EmptyState } from "../components/ui";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

// ============================================================================
// Types
// ============================================================================

type CronSchedule = {
  _id: Id<"cronSchedules">;
  _creationTime: number;
  name: string;
  description: string;
  cronExpression: string;
  handlerKey: string;
  enabled: boolean;
  lastRunAt?: number;
  lastRunStatus?: "completed" | "failed" | "running";
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
  humanReadable: string;
};

type ExecutionLog = {
  _id: Id<"cronExecutionLog">;
  _creationTime: number;
  cronScheduleId: Id<"cronSchedules">;
  jobName: string;
  status: "running" | "completed" | "failed" | "skipped";
  trigger: "scheduled" | "manual";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  errorMessage?: string;
  resultSummary?: string;
  createdAt: number;
};

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status?: string): string {
  switch (status) {
    case "completed": return "green";
    case "failed": return "red";
    case "running": return "blue";
    case "skipped": return "gray";
    default: return "gray";
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) {
    // Future time
    const absDiff = Math.abs(diff);
    if (absDiff < 60_000) return "in < 1m";
    if (absDiff < 3600_000) return `in ${Math.floor(absDiff / 60_000)}m`;
    if (absDiff < 86400_000) return `in ${Math.floor(absDiff / 3600_000)}h`;
    return `in ${Math.floor(absDiff / 86400_000)}d`;
  }

  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// ============================================================================
// Cron Schedule Builder
// ============================================================================

type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "custom";

const MINUTE_INTERVALS = [
  { value: "1", label: "Every minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "10", label: "Every 10 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

const MINUTES_OF_HOUR = [
  { value: "0", label: ":00" },
  { value: "15", label: ":15" },
  { value: "30", label: ":30" },
  { value: "45", label: ":45" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"}`,
}));

/** Detect frequency + params from an existing cron expression */
function parseCronToBuilder(expr: string) {
  const defaults = {
    frequency: "custom" as Frequency,
    minuteInterval: "5",
    hour: "2",
    minute: "0",
    dayOfWeek: "1",
    dayOfMonth: "1",
  };

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return defaults;

  const [min, hr, dom, mon, dow] = parts;

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return { ...defaults, frequency: "minutes" as Frequency, minuteInterval: min.slice(2) };
  }

  // Hourly: N * * * *
  if (/^\d+$/.test(min) && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return { ...defaults, frequency: "hourly" as Frequency, minute: min };
  }

  // Daily: N N * * *
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === "*" && mon === "*" && dow === "*") {
    return { ...defaults, frequency: "daily" as Frequency, hour: hr, minute: min };
  }

  // Weekly: N N * * N
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === "*" && mon === "*" && /^\d+$/.test(dow)) {
    return { ...defaults, frequency: "weekly" as Frequency, hour: hr, minute: min, dayOfWeek: dow };
  }

  // Monthly: N N N * *
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dom) && mon === "*" && dow === "*") {
    return { ...defaults, frequency: "monthly" as Frequency, hour: hr, minute: min, dayOfMonth: dom };
  }

  return defaults;
}

function buildCronExpression(
  frequency: Frequency,
  params: { minuteInterval: string; hour: string; minute: string; dayOfWeek: string; dayOfMonth: string },
  customExpr: string
): string {
  switch (frequency) {
    case "minutes":
      return `*/${params.minuteInterval} * * * *`;
    case "hourly":
      return `${params.minute} * * * *`;
    case "daily":
      return `${params.minute} ${params.hour} * * *`;
    case "weekly":
      return `${params.minute} ${params.hour} * * ${params.dayOfWeek}`;
    case "monthly":
      return `${params.minute} ${params.hour} ${params.dayOfMonth} * *`;
    case "custom":
      return customExpr;
  }
}

function CronScheduleBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (expr: string) => void;
}) {
  const parsed = useMemo(() => parseCronToBuilder(value), []);

  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency);
  const [minuteInterval, setMinuteInterval] = useState(parsed.minuteInterval);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [dayOfWeek, setDayOfWeek] = useState(parsed.dayOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);
  const [customExpr, setCustomExpr] = useState(value);

  const computeAndEmit = useCallback(
    (
      freq: Frequency,
      params: { minuteInterval: string; hour: string; minute: string; dayOfWeek: string; dayOfMonth: string },
      custom: string
    ) => {
      const expr = buildCronExpression(freq, params, custom);
      onChange(expr);
    },
    [onChange]
  );

  // Emit on any param change
  useEffect(() => {
    computeAndEmit(frequency, { minuteInterval, hour, minute, dayOfWeek, dayOfMonth }, customExpr);
  }, [frequency, minuteInterval, hour, minute, dayOfWeek, dayOfMonth, customExpr, computeAndEmit]);

  const validation = useQuery(
    api.cronManager.validateCron,
    value ? { expression: value } : "skip"
  );

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>Schedule</Text>

      <SegmentedControl
        value={frequency}
        onChange={(val) => setFrequency(val as Frequency)}
        data={[
          { value: "minutes", label: "Minutes" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "custom", label: "Custom" },
        ]}
        size="xs"
        fullWidth
      />

      {/* Frequency-specific controls */}
      {frequency === "minutes" && (
        <Select
          label="Run interval"
          data={MINUTE_INTERVALS}
          value={minuteInterval}
          onChange={(val) => val && setMinuteInterval(val)}
          allowDeselect={false}
        />
      )}

      {frequency === "hourly" && (
        <Select
          label="At minute"
          data={MINUTES_OF_HOUR}
          value={minute}
          onChange={(val) => val && setMinute(val)}
          allowDeselect={false}
        />
      )}

      {frequency === "daily" && (
        <Group grow>
          <Select
            label="At hour"
            data={HOURS}
            value={hour}
            onChange={(val) => val && setHour(val)}
            allowDeselect={false}
            searchable
          />
          <Select
            label="At minute"
            data={MINUTES_OF_HOUR}
            value={minute}
            onChange={(val) => val && setMinute(val)}
            allowDeselect={false}
          />
        </Group>
      )}

      {frequency === "weekly" && (
        <>
          <Select
            label="Day of week"
            data={DAYS_OF_WEEK}
            value={dayOfWeek}
            onChange={(val) => val && setDayOfWeek(val)}
            allowDeselect={false}
          />
          <Group grow>
            <Select
              label="At hour"
              data={HOURS}
              value={hour}
              onChange={(val) => val && setHour(val)}
              allowDeselect={false}
              searchable
            />
            <Select
              label="At minute"
              data={MINUTES_OF_HOUR}
              value={minute}
              onChange={(val) => val && setMinute(val)}
              allowDeselect={false}
            />
          </Group>
        </>
      )}

      {frequency === "monthly" && (
        <>
          <Select
            label="Day of month"
            data={DAYS_OF_MONTH}
            value={dayOfMonth}
            onChange={(val) => val && setDayOfMonth(val)}
            allowDeselect={false}
            searchable
          />
          <Group grow>
            <Select
              label="At hour"
              data={HOURS}
              value={hour}
              onChange={(val) => val && setHour(val)}
              allowDeselect={false}
              searchable
            />
            <Select
              label="At minute"
              data={MINUTES_OF_HOUR}
              value={minute}
              onChange={(val) => val && setMinute(val)}
              allowDeselect={false}
            />
          </Group>
        </>
      )}

      {frequency === "custom" && (
        <TextInput
          label="Cron expression"
          value={customExpr}
          onChange={(e) => setCustomExpr(e.currentTarget.value)}
          placeholder="0 2 * * *"
          description="5 fields: minute hour dayOfMonth month dayOfWeek"
          leftSection={<IconCode size={14} />}
          error={validation && !validation.valid ? validation.error : undefined}
        />
      )}

      {/* Result preview */}
      <Paper p="xs" radius="sm" bg="gray.0" withBorder>
        <Group gap="xs" mb={4}>
          <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
          <Text size="xs" fw={500} c="dimmed">Preview</Text>
        </Group>
        <Group gap="xs" align="center">
          <Code>{value}</Code>
          {validation?.valid && (
            <Text size="xs" c="dimmed">— {validation.humanReadable}</Text>
          )}
        </Group>
        {validation?.valid && validation.nextFireTimes.length > 0 && (
          <Box mt={6}>
            <Text size="xs" c="dimmed" fw={500} mb={2}>Next runs:</Text>
            {validation.nextFireTimes.slice(0, 3).map((t: number, i: number) => (
              <Text key={i} size="xs" c="dimmed" ml="xs">
                {formatDateTime(t)}
              </Text>
            ))}
          </Box>
        )}
        {validation && !validation.valid && (
          <Text size="xs" c="red" mt={4}>{validation.error}</Text>
        )}
      </Paper>
    </Stack>
  );
}

// ============================================================================
// Edit Schedule Modal
// ============================================================================

function EditScheduleModal({
  schedule,
  opened,
  onClose,
}: {
  schedule: CronSchedule | null;
  opened: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const updateSchedule = useMutation(api.cronManager.updateSchedule);

  // Sync form when schedule changes
  const scheduleId = schedule?._id;
  useState(() => {
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description);
      setCronExpression(schedule.cronExpression);
      setEnabled(schedule.enabled);
    }
  });

  // Re-sync when modal opens with a new schedule
  if (opened && schedule && name !== schedule.name && !saving) {
    setName(schedule.name);
    setDescription(schedule.description);
    setCronExpression(schedule.cronExpression);
    setEnabled(schedule.enabled);
  }

  const handleSave = async () => {
    if (!scheduleId) return;
    setSaving(true);
    try {
      await updateSchedule({
        id: scheduleId,
        name,
        description,
        cronExpression,
        enabled,
      });
      showSuccessToast("Schedule updated successfully");
      onClose();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Edit Schedule" size="md">
      <Stack gap="md">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
        />
        <Divider />
        {opened && (
          <CronScheduleBuilder
            key={scheduleId}
            value={cronExpression}
            onChange={setCronExpression}
          />
        )}
        <Divider />
        <Switch
          label="Enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ============================================================================
// Create Schedule Modal
// ============================================================================

function CreateScheduleModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [handlerKey, setHandlerKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const createSchedule = useMutation(api.cronManager.createSchedule);
  const handlers = useQuery(api.cronManager.getAvailableHandlers);

  const handleCreate = async () => {
    if (!handlerKey) return;
    setSaving(true);
    try {
      await createSchedule({
        name,
        description,
        cronExpression,
        handlerKey,
        enabled,
      });
      showSuccessToast("Schedule created successfully");
      setName("");
      setDescription("");
      setCronExpression("");
      setHandlerKey(null);
      setEnabled(true);
      onClose();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Schedule" size="md">
      <Stack gap="md">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
        />
        <Select
          label="Handler"
          placeholder="Select handler"
          data={handlers ?? []}
          value={handlerKey}
          onChange={setHandlerKey}
          required
        />
        <Divider />
        {opened && (
          <CronScheduleBuilder
            value={cronExpression}
            onChange={setCronExpression}
          />
        )}
        <Divider />
        <Switch
          label="Enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCreate}
            loading={saving}
            disabled={!name || !cronExpression || !handlerKey}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ============================================================================
// Execution Log Modal
// ============================================================================

function ExecutionLogModal({
  schedule,
  opened,
  onClose,
}: {
  schedule: CronSchedule | null;
  opened: boolean;
  onClose: () => void;
}) {
  const logs = useQuery(
    api.cronManager.getExecutionLog,
    schedule ? { cronScheduleId: schedule._id } : "skip"
  ) as ExecutionLog[] | undefined;

  return (
    <Modal opened={opened} onClose={onClose} title={`Execution Log: ${schedule?.name ?? ""}`} size="lg">
      {!logs ? (
        <Stack gap="sm">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      ) : logs.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">No executions recorded yet.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Trigger</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.map((log) => (
              <Table.Tr key={log._id}>
                <Table.Td>
                  <Tooltip label={formatDateTime(log.startedAt)}>
                    <Text size="sm">{formatRelativeTime(log.startedAt)}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="outline" color={log.trigger === "manual" ? "violet" : "gray"}>
                    {log.trigger}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={getStatusColor(log.status)}>
                    {log.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{log.durationMs != null ? formatDuration(log.durationMs) : "—"}</Text>
                </Table.Td>
                <Table.Td>
                  {log.errorMessage ? (
                    <Tooltip label={log.errorMessage} multiline w={300}>
                      <Text size="xs" c="red" lineClamp={1}>{log.errorMessage}</Text>
                    </Tooltip>
                  ) : log.resultSummary ? (
                    <Text size="xs" c="dimmed" lineClamp={1}>{log.resultSummary}</Text>
                  ) : (
                    <Text size="xs" c="dimmed">—</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Modal>
  );
}

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

function DeleteConfirmModal({
  schedule,
  opened,
  onClose,
}: {
  schedule: CronSchedule | null;
  opened: boolean;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const deleteSchedule = useMutation(api.cronManager.deleteSchedule);

  const handleDelete = async () => {
    if (!schedule) return;
    setDeleting(true);
    try {
      await deleteSchedule({ id: schedule._id });
      showSuccessToast("Schedule deleted");
      onClose();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to delete schedule");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete Schedule" size="sm">
      <Stack gap="md">
        <Group gap="sm">
          <ThemeIcon color="red" variant="light" size="lg">
            <IconAlertTriangle size={20} />
          </ThemeIcon>
          <Text>
            Delete <strong>{schedule?.name}</strong>? This will also remove all execution history.
          </Text>
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" onClick={handleDelete} loading={deleting}>Delete</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function CronManagementPage() {
  const schedules = useQuery(api.cronManager.listSchedules) as CronSchedule[] | undefined;
  const recentExecutions = useQuery(api.cronManager.getRecentExecutions, { limit: 50 }) as ExecutionLog[] | undefined;
  const toggleSchedule = useMutation(api.cronManager.toggleSchedule);
  const triggerManualRun = useAction(api.cronManager.triggerManualRun);

  // Modal state
  const [editModalOpened, editModalHandlers] = useDisclosure(false);
  const [createModalOpened, createModalHandlers] = useDisclosure(false);
  const [logModalOpened, logModalHandlers] = useDisclosure(false);
  const [deleteModalOpened, deleteModalHandlers] = useDisclosure(false);

  const [selectedSchedule, setSelectedSchedule] = useState<CronSchedule | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const isLoading = schedules === undefined;

  // Stats
  const stats = useMemo(() => {
    if (!schedules || !recentExecutions) {
      return { total: 0, active: 0, lastRunTime: null as number | null, failed24h: 0 };
    }

    const now = Date.now();
    const dayAgo = now - 86400_000;

    return {
      total: schedules.length,
      active: schedules.filter((s) => s.enabled).length,
      lastRunTime: schedules.reduce((latest, s) => {
        if (s.lastRunAt && (!latest || s.lastRunAt > latest)) return s.lastRunAt;
        return latest;
      }, null as number | null),
      failed24h: recentExecutions.filter(
        (e) => e.status === "failed" && e.startedAt > dayAgo
      ).length,
    };
  }, [schedules, recentExecutions]);

  const handleToggle = async (id: Id<"cronSchedules">) => {
    try {
      const result = await toggleSchedule({ id });
      showSuccessToast(result.enabled ? "Schedule enabled" : "Schedule disabled");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to toggle schedule");
    }
  };

  const handleTrigger = async (schedule: CronSchedule) => {
    setTriggeringId(schedule._id);
    try {
      await triggerManualRun({ id: schedule._id });
      showSuccessToast(`Manual run triggered for "${schedule.name}"`);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to trigger manual run");
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <Container size="lg" py="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconClock size={20} />
            </ThemeIcon>
            <div>
              <Title order={2}>Cron Jobs</Title>
              <Text size="sm" c="dimmed">Manage scheduled tasks and view execution history</Text>
            </div>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={createModalHandlers.open}>
            New Schedule
          </Button>
        </Group>

        {/* Stat Cards */}
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Paper p="md" withBorder radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total</Text>
            <Text size="xl" fw={700}>{stats.total}</Text>
          </Paper>
          <Paper p="md" withBorder radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Active</Text>
            <Text size="xl" fw={700} c="green">{stats.active}</Text>
          </Paper>
          <Paper p="md" withBorder radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Last Run</Text>
            <Text size="xl" fw={700}>
              {stats.lastRunTime ? formatRelativeTime(stats.lastRunTime) : "—"}
            </Text>
          </Paper>
          <Paper p="md" withBorder radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Failed (24h)</Text>
            <Text size="xl" fw={700} c={stats.failed24h > 0 ? "red" : undefined}>
              {stats.failed24h}
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Schedules Table */}
        {isLoading ? (
          <Stack gap="sm">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} radius="md" />
            ))}
          </Stack>
        ) : schedules.length === 0 ? (
          <EmptyState
            title="No cron schedules"
            description="Schedules will be created automatically on the first scheduler tick, or create one manually."
          />
        ) : (
          <Paper withBorder radius="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Run</Table.Th>
                  <Table.Th>Next Run</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {schedules.map((schedule) => (
                  <Table.Tr key={schedule._id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{schedule.name}</Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>{schedule.description}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Code>{schedule.cronExpression}</Code>
                        <Text size="xs" c="dimmed">{schedule.humanReadable}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        size="sm"
                        checked={schedule.enabled}
                        onChange={() => handleToggle(schedule._id)}
                        label={schedule.enabled ? "On" : "Off"}
                      />
                    </Table.Td>
                    <Table.Td>
                      {schedule.lastRunAt ? (
                        <Group gap={6}>
                          <Tooltip label={formatDateTime(schedule.lastRunAt)}>
                            <Text size="sm">{formatRelativeTime(schedule.lastRunAt)}</Text>
                          </Tooltip>
                          {schedule.lastRunStatus && (
                            <Badge size="xs" color={getStatusColor(schedule.lastRunStatus)}>
                              {schedule.lastRunStatus}
                            </Badge>
                          )}
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">Never</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {schedule.enabled && schedule.nextRunAt ? (
                        <Tooltip label={formatDateTime(schedule.nextRunAt)}>
                          <Text size="sm">{formatRelativeTime(schedule.nextRunAt)}</Text>
                        </Tooltip>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Trigger now">
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            loading={triggeringId === schedule._id}
                            onClick={() => handleTrigger(schedule)}
                          >
                            <IconPlayerPlay size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              editModalHandlers.open();
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="History">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              logModalHandlers.open();
                            }}
                          >
                            <IconHistory size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              deleteModalHandlers.open();
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>

      {/* Modals */}
      <EditScheduleModal
        schedule={selectedSchedule}
        opened={editModalOpened}
        onClose={editModalHandlers.close}
      />
      <CreateScheduleModal
        opened={createModalOpened}
        onClose={createModalHandlers.close}
      />
      <ExecutionLogModal
        schedule={selectedSchedule}
        opened={logModalOpened}
        onClose={logModalHandlers.close}
      />
      <DeleteConfirmModal
        schedule={selectedSchedule}
        opened={deleteModalOpened}
        onClose={deleteModalHandlers.close}
      />
    </Container>
  );
}
