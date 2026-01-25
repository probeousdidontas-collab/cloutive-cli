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
  Badge,
  Tooltip,
  TextInput,
  Skeleton,
  Box,
  ThemeIcon,
} from "@mantine/core";
import {
  IconFilter,
  IconFilterOff,
  IconServer,
  IconSortAscending,
  IconChevronUp,
  IconChevronDown,
  IconBulb,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  resources: {
    list: "api.resources.list",
  },
  awsAccounts: {
    listByOrganization: "api.awsAccounts.listByOrganization",
  },
  recommendations: {
    list: "api.recommendations.list",
  },
};

interface Resource {
  _id: string;
  awsAccountId: string;
  resourceType: string;
  resourceId: string;
  name?: string;
  region?: string;
  tags?: Record<string, string>;
  monthlyCost?: number;
  createdAt: number;
  updatedAt: number;
}

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

interface Recommendation {
  _id: string;
  awsAccountId: string;
  type: string;
  title: string;
  description: string;
  estimatedSavings: number;
  status: string;
  resourceId?: string;
}

type SortField = "name" | "type" | "region" | "cost" | "account";
type SortDirection = "asc" | "desc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getResourceTypeColor(type: string): string {
  const colors: Record<string, string> = {
    EC2: "blue",
    RDS: "violet",
    S3: "green",
    Lambda: "orange",
    EBS: "cyan",
    ELB: "teal",
    DynamoDB: "yellow",
    ElastiCache: "red",
    ECS: "indigo",
    EKS: "grape",
  };
  return colors[type] || "gray";
}

export function ResourcesPage() {
  // Filters state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Fetch data
  const resources = useQuery(api.resources.list) as Resource[] | undefined;
  const accounts = useQuery(api.awsAccounts.listByOrganization) as AwsAccount[] | undefined;
  const recommendations = useQuery(api.recommendations.list) as Recommendation[] | undefined;

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    if (!resources) return { types: [], regions: [] };

    const types = [...new Set(resources.map((r) => r.resourceType))].sort();
    const regions = [...new Set(resources.map((r) => r.region).filter(Boolean))].sort() as string[];

    return { types, regions };
  }, [resources]);

  const accountOptions = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((a) => ({ value: a._id, label: `${a.name} (${a.accountNumber})` }));
  }, [accounts]);

  // Build a map of resourceId -> recommendations
  const recommendationsByResourceId = useMemo(() => {
    if (!recommendations) return new Map<string, Recommendation[]>();

    const map = new Map<string, Recommendation[]>();
    for (const rec of recommendations) {
      if (rec.resourceId && rec.status === "open") {
        const existing = map.get(rec.resourceId) || [];
        existing.push(rec);
        map.set(rec.resourceId, existing);
      }
    }
    return map;
  }, [recommendations]);

  // Apply filters
  const filteredResources = useMemo(() => {
    if (!resources) return [];

    return resources.filter((resource) => {
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(resource.resourceType)) {
        return false;
      }

      // Region filter
      if (selectedRegions.length > 0 && (!resource.region || !selectedRegions.includes(resource.region))) {
        return false;
      }

      // Account filter
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(resource.awsAccountId)) {
        return false;
      }

      // Tag filter (simple text search in tag keys/values)
      if (tagFilter) {
        const tagString = JSON.stringify(resource.tags || {}).toLowerCase();
        if (!tagString.includes(tagFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [resources, selectedTypes, selectedRegions, selectedAccounts, tagFilter]);

  // Sort data
  const sortedResources = useMemo(() => {
    const sorted = [...filteredResources].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = (a.name || a.resourceId).localeCompare(b.name || b.resourceId);
          break;
        case "type":
          comparison = a.resourceType.localeCompare(b.resourceType);
          break;
        case "region":
          comparison = (a.region || "").localeCompare(b.region || "");
          break;
        case "cost":
          comparison = (a.monthlyCost || 0) - (b.monthlyCost || 0);
          break;
        case "account":
          comparison = a.awsAccountId.localeCompare(b.awsAccountId);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredResources, sortField, sortDirection]);

  // Calculate total cost
  const totalCost = useMemo(() => {
    return sortedResources.reduce((sum, r) => sum + (r.monthlyCost || 0), 0);
  }, [sortedResources]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedTypes([]);
    setSelectedRegions([]);
    setSelectedAccounts([]);
    setTagFilter("");
  }, []);

  // Handle sort
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  // Get account name by ID
  const getAccountName = useCallback(
    (accountId: string): string => {
      const account = accounts?.find((a) => a._id === accountId);
      return account?.name || accountId;
    },
    [accounts]
  );

  const isLoading = resources === undefined || accounts === undefined;

  // Sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconSortAscending size={14} style={{ opacity: 0.3 }} />;
    }
    return sortDirection === "asc" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  return (
    <Container data-testid="resources-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Resources</Title>
            <Text c="dimmed" size="sm">
              AWS resource inventory discovered by AI agent
            </Text>
          </Stack>
          <Badge variant="light" color="blue" size="lg" leftSection={<IconServer size={14} />}>
            {sortedResources.length} Resource{sortedResources.length !== 1 ? "s" : ""}
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
              <Box data-testid="resource-type-filter">
                <MultiSelect
                  label="Resource Type"
                  placeholder="All types"
                  data={filterOptions.types}
                  value={selectedTypes}
                  onChange={setSelectedTypes}
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

            <Group grow align="flex-start">
              <Box data-testid="tag-filter">
                <TextInput
                  label="Tag Search"
                  placeholder="Search in tags..."
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                />
              </Box>
              <Box /> {/* Spacer */}
              <Box /> {/* Spacer */}
            </Group>
          </Stack>
        </Paper>

        {/* Total Summary */}
        <Paper data-testid="total-cost-summary" withBorder p="md">
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Text size="sm" c="dimmed">
                Showing {sortedResources.length} resource{sortedResources.length !== 1 ? "s" : ""}
              </Text>
              {(selectedTypes.length > 0 ||
                selectedRegions.length > 0 ||
                selectedAccounts.length > 0 ||
                tagFilter) && (
                <Badge variant="light" color="blue">
                  Filtered
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Total Monthly Cost:
              </Text>
              <Text size="lg" fw={700} c="blue">
                {formatCurrency(totalCost)}
              </Text>
            </Group>
          </Group>
        </Paper>

        {/* Resources Table */}
        <Paper data-testid="resources-table" withBorder p="md">
          {isLoading ? (
            <Stack gap="sm">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={40} />
              ))}
            </Stack>
          ) : sortedResources.length === 0 ? (
            <Stack align="center" py="xl">
              <IconServer size={48} style={{ opacity: 0.3 }} />
              <Text c="dimmed" ta="center">
                No resources found.
                {(selectedTypes.length > 0 ||
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
                      onClick={() => handleSort("name")}
                      data-testid="sort-by-name"
                    >
                      Name
                      {renderSortIcon("name")}
                    </Group>
                  </Table.Th>
                  <Table.Th>
                    <Group
                      gap={4}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("type")}
                    >
                      Type
                      {renderSortIcon("type")}
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
                  <Table.Th style={{ textAlign: "right" }}>
                    <Group
                      gap={4}
                      justify="flex-end"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("cost")}
                      data-testid="sort-by-cost"
                    >
                      Monthly Cost
                      {renderSortIcon("cost")}
                    </Group>
                  </Table.Th>
                  <Table.Th>Tags</Table.Th>
                  <Table.Th>Recommendations</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedResources.map((resource) => {
                  const resourceRecs = recommendationsByResourceId.get(resource.resourceId) || [];
                  const hasRecommendations = resourceRecs.length > 0;
                  const totalSavings = resourceRecs.reduce((sum, r) => sum + r.estimatedSavings, 0);

                  return (
                    <Table.Tr key={resource._id}>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={500}>{resource.name || resource.resourceId}</Text>
                          {resource.name && (
                            <Text size="xs" c="dimmed">
                              {resource.resourceId}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getResourceTypeColor(resource.resourceType)} variant="light">
                          {resource.resourceType}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {resource.region ? (
                          <Badge variant="outline" size="sm">
                            {resource.region}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{getAccountName(resource.awsAccountId)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        {resource.monthlyCost !== undefined ? (
                          <Text fw={500}>{formatCurrency(resource.monthlyCost)}</Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {resource.tags && Object.keys(resource.tags).length > 0 ? (
                          <Group gap={4}>
                            {Object.entries(resource.tags)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <Tooltip key={key} label={`${key}: ${value}`}>
                                  <Badge size="xs" variant="dot">
                                    {key}
                                  </Badge>
                                </Tooltip>
                              ))}
                            {Object.keys(resource.tags).length > 2 && (
                              <Tooltip
                                label={Object.entries(resource.tags)
                                  .slice(2)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")}
                              >
                                <Badge size="xs" variant="light">
                                  +{Object.keys(resource.tags).length - 2}
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
                      <Table.Td>
                        {hasRecommendations ? (
                          <Tooltip
                            label={
                              <Stack gap={4}>
                                {resourceRecs.map((rec) => (
                                  <Text key={rec._id} size="xs">
                                    {rec.title} (${rec.estimatedSavings}/mo)
                                  </Text>
                                ))}
                              </Stack>
                            }
                          >
                            <Group
                              gap={4}
                              data-testid={`recommendation-indicator-${resource._id}`}
                              style={{ cursor: "pointer" }}
                            >
                              <ThemeIcon size="sm" variant="light" color="orange">
                                <IconBulb size={12} />
                              </ThemeIcon>
                              <Badge size="sm" variant="light" color="green">
                                Save ${totalSavings}/mo
                              </Badge>
                            </Group>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}

export default ResourcesPage;
