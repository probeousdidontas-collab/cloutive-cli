import { useState, useMemo, useCallback } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  MultiSelect,
  Badge,
  Skeleton,
  Box,
  ThemeIcon,
  Card,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { EmptyState } from "../components/ui";
import {
  IconFilter,
  IconFilterOff,
  IconBell,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconAlertCircle,
  IconPigMoney,
  IconTrendingUp,
  IconBulb,
  IconFlame,
  IconZzz,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  alerts: {
    list: "api.alerts.list",
    acknowledge: "api.alerts.acknowledge",
  },
};

interface Alert {
  _id: string;
  organizationId: string;
  type: "budget_exceeded" | "anomaly_detected" | "recommendation_available" | "cost_spike" | "resource_idle";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  triggeredAt: number;
  acknowledgedAt?: number;
  createdAt: number;
  updatedAt: number;
}

type AlertType = Alert["type"];
type AlertSeverity = Alert["severity"];
type AlertStatus = "acknowledged" | "unacknowledged";

function getAlertTypeColor(type: AlertType): string {
  const colors: Record<AlertType, string> = {
    budget_exceeded: "red",
    anomaly_detected: "orange",
    recommendation_available: "blue",
    cost_spike: "yellow",
    resource_idle: "gray",
  };
  return colors[type] || "gray";
}

function getAlertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    budget_exceeded: "Budget",
    anomaly_detected: "Anomaly",
    recommendation_available: "Recommendation",
    cost_spike: "Cost Spike",
    resource_idle: "Idle Resource",
  };
  return labels[type] || type;
}

function getAlertTypeIcon(type: AlertType) {
  const icons: Record<AlertType, React.ReactNode> = {
    budget_exceeded: <IconPigMoney size={16} />,
    anomaly_detected: <IconTrendingUp size={16} />,
    recommendation_available: <IconBulb size={16} />,
    cost_spike: <IconFlame size={16} />,
    resource_idle: <IconZzz size={16} />,
  };
  return icons[type] || <IconBell size={16} />;
}

function getSeverityColor(severity: AlertSeverity): string {
  const colors: Record<AlertSeverity, string> = {
    critical: "red",
    warning: "orange",
    info: "blue",
  };
  return colors[severity] || "gray";
}

function getSeverityIcon(severity: AlertSeverity) {
  const icons: Record<AlertSeverity, React.ReactNode> = {
    critical: <IconAlertCircle size={18} />,
    warning: <IconAlertTriangle size={18} />,
    info: <IconInfoCircle size={18} />,
  };
  return icons[severity] || <IconBell size={18} />;
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

export function AlertsPage() {
  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);

  // Fetch data
  const alerts = useQuery(api.alerts.list) as Alert[] | undefined;

  // Mutation for acknowledging alerts
  const acknowledgeAlert = useMutation(api.alerts.acknowledge);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    if (!alerts) return { types: [], severities: [] };

    const types = [...new Set(alerts.map((a) => a.type))].sort();
    const severities = [...new Set(alerts.map((a) => a.severity))].sort();

    return { types, severities };
  }, [alerts]);

  const typeOptions = useMemo(() => {
    return filterOptions.types.map((type) => ({
      value: type,
      label: getAlertTypeLabel(type as AlertType),
    }));
  }, [filterOptions.types]);

  const severityOptions = useMemo(() => {
    return filterOptions.severities.map((severity) => ({
      value: severity,
      label: severity.charAt(0).toUpperCase() + severity.slice(1),
    }));
  }, [filterOptions.severities]);

  const statusOptions = [
    { value: "unacknowledged", label: "Unacknowledged" },
    { value: "acknowledged", label: "Acknowledged" },
  ];

  // Apply filters and sort by triggered time (newest first)
  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];

    return alerts
      .filter((alert) => {
        // Type filter
        if (selectedTypes.length > 0 && !selectedTypes.includes(alert.type)) {
          return false;
        }

        // Status filter
        if (selectedStatuses.length > 0) {
          const isAcknowledged = alert.acknowledgedAt !== undefined;
          const status: AlertStatus = isAcknowledged ? "acknowledged" : "unacknowledged";
          if (!selectedStatuses.includes(status)) {
            return false;
          }
        }

        // Severity filter
        if (selectedSeverities.length > 0 && !selectedSeverities.includes(alert.severity)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  }, [alerts, selectedTypes, selectedStatuses, selectedSeverities]);

  // Calculate unacknowledged count
  const unacknowledgedCount = useMemo(() => {
    if (!alerts) return 0;
    return alerts.filter((a) => a.acknowledgedAt === undefined).length;
  }, [alerts]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedSeverities([]);
  }, []);

  // Handle acknowledge
  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      try {
        await acknowledgeAlert({ id: alertId });
        showSuccessToast("Alert acknowledged successfully");
      } catch {
        showErrorToast("Failed to acknowledge alert. Please try again.");
      }
    },
    [acknowledgeAlert]
  );

  const isLoading = alerts === undefined;

  return (
    <Container data-testid="alerts-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Alerts</Title>
            <Text c="dimmed" size="sm">
              Monitor and manage cost alerts and notifications
            </Text>
          </Stack>
          <Badge
            data-testid="unacknowledged-count"
            variant="filled"
            color="red"
            size="lg"
            leftSection={<IconBell size={14} />}
          >
            {unacknowledgedCount}
          </Badge>
        </Group>

        {/* Filters */}
        <Paper data-testid="filters-section" withBorder p="md">
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
                  label="Alert Type"
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

              <Box data-testid="severity-filter">
                <MultiSelect
                  label="Severity"
                  placeholder="All severities"
                  data={severityOptions}
                  value={selectedSeverities}
                  onChange={setSelectedSeverities}
                  clearable
                  searchable
                />
              </Box>
            </Group>
          </Stack>
        </Paper>

        {/* Results Count */}
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Showing {filteredAlerts.length} alert
            {filteredAlerts.length !== 1 ? "s" : ""}
            {(selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedSeverities.length > 0) && (
              <Badge variant="light" color="blue" ml="xs">
                Filtered
              </Badge>
            )}
          </Text>
        </Group>

        {/* Alerts List */}
        <Stack data-testid="alerts-list" gap="md">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </>
          ) : filteredAlerts.length === 0 ? (
            <EmptyState
              title="No alerts found"
              description={
                selectedTypes.length > 0 ||
                selectedStatuses.length > 0 ||
                selectedSeverities.length > 0
                  ? "Try adjusting your filters to see more results."
                  : "You're all caught up! No alerts at this time."
              }
              icon="bell"
              variant={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedSeverities.length > 0 ? "filtered" : "notifications"}
              actionLabel={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedSeverities.length > 0 ? "Clear Filters" : undefined}
              onAction={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedSeverities.length > 0 ? handleClearFilters : undefined}
            />
          ) : (
            filteredAlerts.map((alert) => {
              const isAcknowledged = alert.acknowledgedAt !== undefined;

              return (
                <Card
                  key={alert._id}
                  data-testid={`alert-item-${alert._id}`}
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: `var(--mantine-color-${getSeverityColor(alert.severity)}-6)`,
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: 1 }}>
                      {/* Severity Icon */}
                      <ThemeIcon
                        data-testid={`severity-indicator-${alert._id}`}
                        variant="light"
                        color={getSeverityColor(alert.severity)}
                        size="lg"
                        radius="xl"
                      >
                        {getSeverityIcon(alert.severity)}
                      </ThemeIcon>

                      <Stack gap="xs" style={{ flex: 1 }}>
                        {/* Badges Row */}
                        <Group gap="sm">
                          <Badge
                            color={getAlertTypeColor(alert.type)}
                            variant="light"
                            leftSection={getAlertTypeIcon(alert.type)}
                          >
                            {getAlertTypeLabel(alert.type)}
                          </Badge>
                          <Badge
                            color={getSeverityColor(alert.severity)}
                            variant="outline"
                          >
                            {alert.severity}
                          </Badge>
                          {isAcknowledged && (
                            <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                              Acknowledged
                            </Badge>
                          )}
                        </Group>

                        {/* Title */}
                        <Text fw={500} size="lg">
                          {alert.title}
                        </Text>

                        {/* Message */}
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {alert.message}
                        </Text>

                        {/* Timestamp */}
                        <Text
                          data-testid={`alert-timestamp-${alert._id}`}
                          size="xs"
                          c="dimmed"
                        >
                          Triggered {formatRelativeTime(alert.triggeredAt)}
                          {isAcknowledged && alert.acknowledgedAt && (
                            <> • Acknowledged {formatRelativeTime(alert.acknowledgedAt)}</>
                          )}
                        </Text>
                      </Stack>
                    </Group>

                    {/* Actions */}
                    <Stack gap="sm" align="flex-end">
                      {!isAcknowledged && (
                        <Tooltip label="Acknowledge Alert">
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="lg"
                            onClick={() => handleAcknowledge(alert._id)}
                            aria-label="Acknowledge"
                          >
                            <IconCheck size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Stack>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

export default AlertsPage;
