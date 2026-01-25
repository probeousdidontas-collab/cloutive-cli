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
  SimpleGrid,
} from "@mantine/core";
import { EmptyState } from "../components/ui";
import {
  IconFilter,
  IconFilterOff,
  IconBulb,
  IconCheck,
  IconX,
  IconChevronUp,
  IconChevronDown,
  IconSortAscending,
  IconSparkles,
  IconCoin,
  IconTrendingDown,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  recommendations: {
    list: "api.recommendations.list",
    updateStatus: "api.recommendations.updateStatus",
  },
  awsAccounts: {
    listByOrganization: "api.awsAccounts.listByOrganization",
  },
};

interface Recommendation {
  _id: string;
  awsAccountId: string;
  type: string;
  title: string;
  description: string;
  estimatedSavings: number;
  status: string;
  resourceId?: string;
  createdAt: number;
  updatedAt: number;
}

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

type SortField = "savings" | "type" | "status" | "date";
type SortDirection = "asc" | "desc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRecommendationTypeColor(type: string): string {
  const colors: Record<string, string> = {
    rightsizing: "blue",
    reserved_instance: "green",
    savings_plan: "teal",
    unused_resource: "red",
    idle_resource: "orange",
    storage_optimization: "cyan",
    network_optimization: "violet",
  };
  return colors[type] || "gray";
}

function getRecommendationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    rightsizing: "Rightsizing",
    reserved_instance: "Reserved Instance",
    savings_plan: "Savings Plan",
    unused_resource: "Unused Resource",
    idle_resource: "Idle Resource",
    storage_optimization: "Storage",
    network_optimization: "Network",
  };
  return labels[type] || type;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: "blue",
    implemented: "green",
    dismissed: "gray",
  };
  return colors[status] || "gray";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Open",
    implemented: "Implemented",
    dismissed: "Dismissed",
  };
  return labels[status] || status;
}

export function RecommendationsPage() {
  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("savings");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch data
  const recommendations = useQuery(api.recommendations.list) as Recommendation[] | undefined;
  const accounts = useQuery(api.awsAccounts.listByOrganization) as AwsAccount[] | undefined;

  // Mutation for updating status
  const updateStatus = useMutation(api.recommendations.updateStatus);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    if (!recommendations) return { types: [], statuses: [] };

    const types = [...new Set(recommendations.map((r) => r.type))].sort();
    const statuses = [...new Set(recommendations.map((r) => r.status))].sort();

    return { types, statuses };
  }, [recommendations]);

  const typeOptions = useMemo(() => {
    return filterOptions.types.map((type) => ({
      value: type,
      label: getRecommendationTypeLabel(type),
    }));
  }, [filterOptions.types]);

  const statusOptions = useMemo(() => {
    return filterOptions.statuses.map((status) => ({
      value: status,
      label: getStatusLabel(status),
    }));
  }, [filterOptions.statuses]);

  const accountOptions = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((a) => ({ value: a._id, label: `${a.name} (${a.accountNumber})` }));
  }, [accounts]);

  // Apply filters
  const filteredRecommendations = useMemo(() => {
    if (!recommendations) return [];

    return recommendations.filter((rec) => {
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(rec.type)) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(rec.status)) {
        return false;
      }

      // Account filter
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(rec.awsAccountId)) {
        return false;
      }

      return true;
    });
  }, [recommendations, selectedTypes, selectedStatuses, selectedAccounts]);

  // Sort data
  const sortedRecommendations = useMemo(() => {
    const sorted = [...filteredRecommendations].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "savings":
          comparison = a.estimatedSavings - b.estimatedSavings;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "date":
          comparison = a.createdAt - b.createdAt;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredRecommendations, sortField, sortDirection]);

  // Calculate totals for open recommendations only
  const { totalPotentialSavings, openRecommendationsCount } = useMemo(() => {
    if (!recommendations) return { totalPotentialSavings: 0, openRecommendationsCount: 0 };

    const openRecs = recommendations.filter((r) => r.status === "open");
    return {
      totalPotentialSavings: openRecs.reduce((sum, r) => sum + r.estimatedSavings, 0),
      openRecommendationsCount: openRecs.length,
    };
  }, [recommendations]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedAccounts([]);
  }, []);

  // Handle sort
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  // Handle status update
  const handleMarkImplemented = useCallback(
    async (recId: string) => {
      try {
        await updateStatus({ id: recId, status: "implemented" });
        showSuccessToast("Recommendation marked as implemented");
      } catch {
        showErrorToast("Failed to update recommendation. Please try again.");
      }
    },
    [updateStatus]
  );

  const handleDismiss = useCallback(
    async (recId: string) => {
      try {
        await updateStatus({ id: recId, status: "dismissed" });
        showSuccessToast("Recommendation dismissed");
      } catch {
        showErrorToast("Failed to dismiss recommendation. Please try again.");
      }
    },
    [updateStatus]
  );

  // Get account name by ID
  const getAccountName = useCallback(
    (accountId: string): string => {
      const account = accounts?.find((a) => a._id === accountId);
      return account?.name || accountId;
    },
    [accounts]
  );

  const isLoading = recommendations === undefined || accounts === undefined;

  // Sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconSortAscending size={14} style={{ opacity: 0.3 }} />;
    }
    return sortDirection === "asc" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  return (
    <Container data-testid="recommendations-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Recommendations</Title>
            <Text c="dimmed" size="sm">
              AI-powered cost optimization recommendations
            </Text>
          </Stack>
          <Badge
            variant="light"
            color="violet"
            size="lg"
            leftSection={<IconSparkles size={14} />}
          >
            AI Generated
          </Badge>
        </Group>

        {/* Total Savings Summary */}
        <Paper data-testid="total-savings-summary" withBorder p="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="green" size="sm">
                  <IconTrendingDown size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Total Potential Savings
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-savings-amount" size="xl" fw={700} c="green">
                  {formatCurrency(totalPotentialSavings)}/mo
                </Text>
              )}
            </Stack>

            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="sm">
                  <IconBulb size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Open Recommendations
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="open-recommendations-count" size="xl" fw={700}>
                  {openRecommendationsCount}
                </Text>
              )}
            </Stack>

            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="orange" size="sm">
                  <IconCoin size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Avg. Savings per Recommendation
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text size="xl" fw={700}>
                  {openRecommendationsCount > 0
                    ? formatCurrency(totalPotentialSavings / openRecommendationsCount)
                    : "$0"}/mo
                </Text>
              )}
            </Stack>
          </SimpleGrid>
        </Paper>

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
                  label="Recommendation Type"
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

              <Box data-testid="account-filter">
                <MultiSelect
                  label="Account"
                  placeholder="All accounts"
                  data={accountOptions}
                  value={selectedAccounts}
                  onChange={setSelectedAccounts}
                  clearable
                  searchable
                />
              </Box>
            </Group>

            {/* Sort Controls */}
            <Group gap="md">
              <Text size="sm" c="dimmed">
                Sort by:
              </Text>
              <Group gap="xs">
                <Button
                  data-testid="sort-by-savings"
                  variant={sortField === "savings" ? "light" : "subtle"}
                  size="xs"
                  rightSection={renderSortIcon("savings")}
                  onClick={() => handleSort("savings")}
                >
                  Savings
                </Button>
                <Button
                  data-testid="sort-by-type"
                  variant={sortField === "type" ? "light" : "subtle"}
                  size="xs"
                  rightSection={renderSortIcon("type")}
                  onClick={() => handleSort("type")}
                >
                  Type
                </Button>
                <Button
                  data-testid="sort-by-status"
                  variant={sortField === "status" ? "light" : "subtle"}
                  size="xs"
                  rightSection={renderSortIcon("status")}
                  onClick={() => handleSort("status")}
                >
                  Status
                </Button>
                <Button
                  data-testid="sort-by-date"
                  variant={sortField === "date" ? "light" : "subtle"}
                  size="xs"
                  rightSection={renderSortIcon("date")}
                  onClick={() => handleSort("date")}
                >
                  Date
                </Button>
              </Group>
            </Group>
          </Stack>
        </Paper>

        {/* Results Count */}
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Showing {sortedRecommendations.length} recommendation
            {sortedRecommendations.length !== 1 ? "s" : ""}
            {(selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedAccounts.length > 0) && (
              <Badge variant="light" color="blue" ml="xs">
                Filtered
              </Badge>
            )}
          </Text>
        </Group>

        {/* Recommendations List */}
        <Stack data-testid="recommendations-list" gap="md">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </>
          ) : sortedRecommendations.length === 0 ? (
            <EmptyState
              title="No recommendations found"
              description={
                selectedTypes.length > 0 ||
                selectedStatuses.length > 0 ||
                selectedAccounts.length > 0
                  ? "Try adjusting your filters to see more results."
                  : "No optimization recommendations available yet. Connect an AWS account to get started."
              }
              variant={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedAccounts.length > 0 ? "filtered" : "default"}
              actionLabel={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedAccounts.length > 0 ? "Clear Filters" : undefined}
              onAction={selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedAccounts.length > 0 ? handleClearFilters : undefined}
            />
          ) : (
            sortedRecommendations.map((rec) => (
              <Card
                key={rec._id}
                data-testid={`recommendation-item-${rec._id}`}
                withBorder
                padding="md"
                radius="md"
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm">
                      <Badge
                        color={getRecommendationTypeColor(rec.type)}
                        variant="light"
                      >
                        {getRecommendationTypeLabel(rec.type)}
                      </Badge>
                      <Badge
                        color={getStatusColor(rec.status)}
                        variant="outline"
                      >
                        {getStatusLabel(rec.status)}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {getAccountName(rec.awsAccountId)}
                      </Text>
                    </Group>

                    <Text fw={500} size="lg">
                      {rec.title}
                    </Text>

                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {rec.description}
                    </Text>

                    {rec.resourceId && (
                      <Text size="xs" c="dimmed">
                        Resource: {rec.resourceId}
                      </Text>
                    )}
                  </Stack>

                  <Stack gap="sm" align="flex-end">
                    <Badge
                      size="xl"
                      variant="light"
                      color="green"
                      style={{ minWidth: 100, textAlign: "center" }}
                    >
                      {formatCurrency(rec.estimatedSavings)}/mo
                    </Badge>

                    {rec.status === "open" && (
                      <Group
                        data-testid={`recommendation-actions-${rec._id}`}
                        gap="xs"
                      >
                        <Tooltip label="Mark as Implemented">
                          <ActionIcon
                            variant="light"
                            color="green"
                            onClick={() => handleMarkImplemented(rec._id)}
                            aria-label="Mark as Implemented"
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Dismiss">
                          <ActionIcon
                            variant="light"
                            color="gray"
                            onClick={() => handleDismiss(rec._id)}
                            aria-label="Dismiss"
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Stack>
                </Group>
              </Card>
            ))
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

export default RecommendationsPage;
