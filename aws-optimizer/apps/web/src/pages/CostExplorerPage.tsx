import { useState, useMemo, useCallback } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Table,
  MultiSelect,
  SegmentedControl,
  Badge,
  Tooltip,
  TextInput,
  Skeleton,
  Box,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { DatesRangeValue } from "@mantine/dates";
import {
  IconDownload,
  IconFilter,
  IconSortAscending,
  IconFilterOff,
  IconCalendar,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";

interface CostRecord {
  _id: string;
  awsAccountId: string;
  date: string;
  service: string;
  region: string;
  cost: number;
  tags?: Record<string, string>;
}

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

type ViewType = "daily" | "weekly" | "monthly";
type SortField = "date" | "service" | "region" | "cost" | "account";
type SortDirection = "asc" | "desc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day;
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split("T")[0];
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

function aggregateCostsByView(
  costs: CostRecord[],
  view: ViewType
): CostRecord[] {
  if (view === "daily") {
    return costs;
  }

  const aggregation = new Map<string, CostRecord>();

  for (const cost of costs) {
    const key =
      view === "weekly"
        ? `${getWeekStart(cost.date)}-${cost.service}-${cost.region}-${cost.awsAccountId}`
        : `${getMonthKey(cost.date)}-${cost.service}-${cost.region}-${cost.awsAccountId}`;

    if (aggregation.has(key)) {
      const existing = aggregation.get(key)!;
      aggregation.set(key, {
        ...existing,
        cost: existing.cost + cost.cost,
      });
    } else {
      aggregation.set(key, {
        ...cost,
        date: view === "weekly" ? getWeekStart(cost.date) : `${getMonthKey(cost.date)}-01`,
      });
    }
  }

  return Array.from(aggregation.values());
}

function generateCSV(costs: CostRecord[], accounts: AwsAccount[]): string {
  const accountMap = new Map(accounts.map((a) => [a._id, a.name]));
  
  const headers = ["Date", "Account", "Service", "Region", "Cost", "Tags"];
  const rows = costs.map((cost) => [
    cost.date,
    accountMap.get(cost.awsAccountId) || cost.awsAccountId,
    cost.service,
    cost.region,
    cost.cost.toFixed(2),
    cost.tags ? JSON.stringify(cost.tags) : "",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CostExplorerPage() {
  // Filters state
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  
  // Handler for date range changes
  const handleDateRangeChange = useCallback((value: DatesRangeValue) => {
    setDateRange(value as [Date | null, Date | null]);
  }, []);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  
  // View and sorting state
  const [view, setView] = useState<ViewType>("daily");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch data - these APIs work without arguments, they get org from auth context
  const costData = useQuery(api.costs.getCostData) as CostRecord[] | undefined;
  const accountsData = useQuery(api.awsAccounts.listByOrganization);
  const accounts = accountsData as AwsAccount[] | undefined;

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    if (!costData) return { services: [], regions: [], tags: [] };

    const services = [...new Set(costData.map((c) => c.service))].sort();
    const regions = [...new Set(costData.map((c) => c.region))].sort();
    const tagKeys = [...new Set(costData.flatMap((c) => Object.keys(c.tags || {})))].sort();

    return { services, regions, tags: tagKeys };
  }, [costData]);

  const accountOptions = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((a) => ({ value: a._id, label: `${a.name} (${a.accountNumber})` }));
  }, [accounts]);

  // Apply filters
  const filteredCosts = useMemo(() => {
    if (!costData) return [];

    return costData.filter((cost) => {
      // Date range filter
      if (dateRange[0] && new Date(cost.date) < dateRange[0]) return false;
      if (dateRange[1] && new Date(cost.date) > dateRange[1]) return false;

      // Service filter
      if (selectedServices.length > 0 && !selectedServices.includes(cost.service)) return false;

      // Region filter
      if (selectedRegions.length > 0 && !selectedRegions.includes(cost.region)) return false;

      // Account filter
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(cost.awsAccountId)) return false;

      // Tag filter (simple text search in tag keys/values)
      if (tagFilter) {
        const tagString = JSON.stringify(cost.tags || {}).toLowerCase();
        if (!tagString.includes(tagFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [costData, dateRange, selectedServices, selectedRegions, selectedAccounts, tagFilter]);

  // Aggregate by view
  const aggregatedCosts = useMemo(() => {
    return aggregateCostsByView(filteredCosts, view);
  }, [filteredCosts, view]);

  // Sort data
  const sortedCosts = useMemo(() => {
    const sorted = [...aggregatedCosts].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          break;
        case "service":
          comparison = a.service.localeCompare(b.service);
          break;
        case "region":
          comparison = a.region.localeCompare(b.region);
          break;
        case "cost":
          comparison = a.cost - b.cost;
          break;
        case "account":
          comparison = a.awsAccountId.localeCompare(b.awsAccountId);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [aggregatedCosts, sortField, sortDirection]);

  // Calculate total
  const totalCost = useMemo(() => {
    return sortedCosts.reduce((sum, cost) => sum + cost.cost, 0);
  }, [sortedCosts]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setDateRange([null, null]);
    setSelectedServices([]);
    setSelectedRegions([]);
    setSelectedAccounts([]);
    setTagFilter("");
  }, []);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField]);

  // Handle CSV export
  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(sortedCosts, accounts || []);
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `aws-costs-${dateStr}.csv`);
  }, [sortedCosts, accounts]);

  // Get account name by ID
  const getAccountName = useCallback(
    (accountId: string): string => {
      const account = accounts?.find((a) => a._id === accountId);
      return account?.name || accountId;
    },
    [accounts]
  );

  const isLoading = costData === undefined || accounts === undefined;

  // Sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconSortAscending size={14} style={{ opacity: 0.3 }} />;
    }
    return sortDirection === "asc" ? (
      <IconChevronUp size={14} />
    ) : (
      <IconChevronDown size={14} />
    );
  };

  return (
    <Container data-testid="cost-explorer-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Cost Explorer</Title>
            <Text c="dimmed" size="sm">
              Analyze spending patterns across your AWS accounts
            </Text>
          </Stack>
          <Button
            data-testid="export-button"
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={handleExportCSV}
            disabled={sortedCosts.length === 0}
          >
            Export CSV
          </Button>
        </Group>

        {/* View Toggle */}
        <Paper data-testid="view-toggle" withBorder p="xs">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconCalendar size={16} />
              <Text size="sm" fw={500}>View:</Text>
            </Group>
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as ViewType)}
              data={[
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Monthly", value: "monthly" },
              ]}
            />
          </Group>
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
              <Box data-testid="date-range-filter">
                <DatePickerInput
                  type="range"
                  label="Date Range"
                  placeholder="Select date range"
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  clearable
                />
              </Box>

              <Box data-testid="service-filter">
                <MultiSelect
                  label="Service"
                  placeholder="All services"
                  data={filterOptions.services}
                  value={selectedServices}
                  onChange={setSelectedServices}
                  clearable
                  searchable
                />
              </Box>

              <Box data-testid="region-filter">
                <MultiSelect
                  label="Region"
                  placeholder="All regions"
                  data={filterOptions.regions}
                  value={selectedRegions}
                  onChange={setSelectedRegions}
                  clearable
                  searchable
                />
              </Box>
            </Group>

            <Group grow align="flex-start">
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

              <Box data-testid="tag-filter">
                <TextInput
                  label="Tag Search"
                  placeholder="Search in tags..."
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                />
              </Box>

              <Box /> {/* Spacer */}
            </Group>
          </Stack>
        </Paper>

        {/* Total Summary */}
        <Paper data-testid="total-cost-summary" withBorder p="md">
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Text size="sm" c="dimmed">
                Showing {sortedCosts.length} record{sortedCosts.length !== 1 ? "s" : ""}
              </Text>
              {(selectedServices.length > 0 ||
                selectedRegions.length > 0 ||
                selectedAccounts.length > 0 ||
                tagFilter ||
                dateRange[0] ||
                dateRange[1]) && (
                <Badge variant="light" color="blue">
                  Filtered
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Total Cost:</Text>
              <Text size="lg" fw={700} c="blue">
                {formatCurrency(totalCost)}
              </Text>
            </Group>
          </Group>
        </Paper>

        {/* Costs Table */}
        <Paper data-testid="costs-table" withBorder p="md">
          {isLoading ? (
            <Stack gap="sm">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={40} />
              ))}
            </Stack>
          ) : sortedCosts.length === 0 ? (
            <Stack align="center" py="xl">
              <Text c="dimmed" ta="center">
                No cost data found.
                {(selectedServices.length > 0 ||
                  selectedRegions.length > 0 ||
                  selectedAccounts.length > 0 ||
                  tagFilter) && (
                  <>
                    <br />
                    Try adjusting your filters.
                  </>
                )}
              </Text>
            </Stack>
          ) : (
            <Table highlightOnHover striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Group
                      gap={4}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("date")}
                      data-testid="sort-by-date"
                    >
                      Date
                      {renderSortIcon("date")}
                    </Group>
                  </Table.Th>
                  <Table.Th>
                    <Group
                      gap={4}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("account")}
                    >
                      Account
                      {renderSortIcon("account")}
                    </Group>
                  </Table.Th>
                  <Table.Th>
                    <Group
                      gap={4}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("service")}
                    >
                      Service
                      {renderSortIcon("service")}
                    </Group>
                  </Table.Th>
                  <Table.Th>
                    <Group
                      gap={4}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("region")}
                    >
                      Region
                      {renderSortIcon("region")}
                    </Group>
                  </Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>
                    <Group
                      gap={4}
                      justify="flex-end"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("cost")}
                      data-testid="sort-by-cost"
                    >
                      Cost
                      {renderSortIcon("cost")}
                    </Group>
                  </Table.Th>
                  <Table.Th>Tags</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedCosts.map((cost) => (
                  <Table.Tr key={cost._id}>
                    <Table.Td>{formatDate(cost.date)}</Table.Td>
                    <Table.Td>
                      <Text size="sm">{getAccountName(cost.awsAccountId)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {cost.service.replace("Amazon ", "").replace("AWS ", "")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {cost.region}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text fw={500}>{formatCurrency(cost.cost)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {cost.tags && Object.keys(cost.tags).length > 0 ? (
                        <Group gap={4}>
                          {Object.entries(cost.tags)
                            .slice(0, 2)
                            .map(([key, value]) => (
                              <Tooltip key={key} label={`${key}: ${value}`}>
                                <Badge size="xs" variant="dot">
                                  {key}
                                </Badge>
                              </Tooltip>
                            ))}
                          {Object.keys(cost.tags).length > 2 && (
                            <Tooltip
                              label={Object.entries(cost.tags)
                                .slice(2)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")}
                            >
                              <Badge size="xs" variant="light">
                                +{Object.keys(cost.tags).length - 2}
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}

export default CostExplorerPage;
