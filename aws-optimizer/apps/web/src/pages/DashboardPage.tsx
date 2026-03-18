import { useMemo } from "react";
import {
  Container,
  Grid,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  ThemeIcon,
  SimpleGrid,
  List,
  Skeleton,
  Center,
  Loader,
  Button,

} from "@mantine/core";
import { DonutChart, AreaChart } from "@mantine/charts";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconCoin,
  IconBulb,
  IconCloud,
  IconChartPie,
  IconChartLine,
  IconUser,
  IconCurrencyDollar,
  IconRocket,
  IconServer,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { useSession, IS_TEST_MODE } from "../lib/auth-client";
import { useOrganization } from "../hooks/useOrganization";

interface CostSnapshot {
  _id: string;
  awsAccountId: string;
  date: string;
  totalCost: number;
  serviceBreakdown?: Record<string, number>;
  regionBreakdown?: Record<string, number>;
}

interface Recommendation {
  _id: string;
  awsAccountId: string;
  type: string;
  title: string;
  description: string;
  estimatedSavings: number;
  status: string;
}

interface DashboardSummary {
  totalAccounts: number;
  activeAccounts: number;
  currentMonthCost: number;
  previousMonthCost: number;
  costChange: number;
  serviceBreakdown: Record<string, number>;
  totalOpenRecommendations: number;
  totalEstimatedSavings: number;
}

// Color palette for charts
const SERVICE_COLORS = [
  "indigo.6",
  "cyan.6",
  "teal.6",
  "green.6",
  "lime.6",
  "yellow.6",
  "orange.6",
  "red.6",
  "pink.6",
  "grape.6",
  "violet.6",
  "blue.6",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
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

// Dashboard section categories for grouping recommendations
const RECOMMENDATION_CATEGORIES: {
  key: string;
  label: string;
  icon: typeof IconCurrencyDollar;
  color: string;
  types: string[];
}[] = [
  {
    key: "cost",
    label: "Cost Optimization",
    icon: IconCurrencyDollar,
    color: "green",
    types: ["reserved_instance", "savings_plan"],
  },
  {
    key: "performance",
    label: "Performance",
    icon: IconRocket,
    color: "blue",
    types: ["rightsizing", "idle_resource"],
  },
  {
    key: "resources",
    label: "Resource Management",
    icon: IconServer,
    color: "orange",
    types: ["unused_resource", "storage_optimization", "network_optimization"],
  },
];

export const DashboardPage = observer(function DashboardPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const navigate = useNavigate();

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

  // In test mode, use empty args (backend handles test mode)
  // Otherwise, pass the Convex organization ID
  const shouldQueryDashboard = isAuthenticated && isOrgReady && (IS_TEST_MODE || organizationId);

  // Fetch dashboard data - skip until we have the organization ID (or in test mode)
  const connectedAccounts = useQuery(
    api.dashboard.getConnectedAccounts,
    shouldQueryDashboard
      ? IS_TEST_MODE
        ? {}
        : { organizationId: organizationId! }
      : "skip"
  ) as { _id: string; name: string; accountNumber: string; status: string }[] | undefined;

  const costSnapshots = useQuery(
    api.dashboard.getCostSnapshots,
    shouldQueryDashboard
      ? IS_TEST_MODE
        ? {} // Empty args for test mode - backend returns mock data
        : { organizationId: organizationId! }
      : "skip"
  ) as CostSnapshot[] | undefined;

  const recommendations = useQuery(
    api.dashboard.getTopRecommendations,
    shouldQueryDashboard
      ? IS_TEST_MODE
        ? {} // Empty args for test mode - backend returns mock data
        : { organizationId: organizationId! }
      : "skip"
  ) as Recommendation[] | undefined;

  const summary = useQuery(
    api.dashboard.getDashboardSummary,
    shouldQueryDashboard
      ? IS_TEST_MODE
        ? {} // Empty args for test mode - backend returns mock data
        : { organizationId: organizationId! }
      : "skip"
  ) as DashboardSummary | undefined;

  // Process cost snapshots for charts
  const { serviceChartData, trendChartData, currentMonthTotal, previousMonthTotal } = useMemo(() => {
    if (!costSnapshots || costSnapshots.length === 0) {
      return {
        serviceChartData: [],
        trendChartData: [],
        currentMonthTotal: 0,
        previousMonthTotal: 0,
      };
    }

    // Get current and previous month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

    // Aggregate service breakdown for current month
    const serviceAggregation: Record<string, number> = {};
    let currTotal = 0;
    let prevTotal = 0;

    for (const snapshot of costSnapshots) {
      const snapshotMonth = snapshot.date.substring(0, 7);
      
      if (snapshotMonth === currentMonthStr) {
        currTotal += snapshot.totalCost;
        if (snapshot.serviceBreakdown) {
          for (const [service, cost] of Object.entries(snapshot.serviceBreakdown)) {
            serviceAggregation[service] = (serviceAggregation[service] || 0) + cost;
          }
        }
      } else if (snapshotMonth === prevMonthStr) {
        prevTotal += snapshot.totalCost;
      }
    }

    // Convert to chart format
    const serviceData = Object.entries(serviceAggregation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8 services
      .map(([name, value], index) => ({
        name: name.replace("Amazon ", "").replace("AWS ", ""),
        value,
        color: SERVICE_COLORS[index % SERVICE_COLORS.length],
      }));

    // Aggregate daily costs for trend chart
    const dailyCosts: Record<string, number> = {};
    for (const snapshot of costSnapshots) {
      dailyCosts[snapshot.date] = (dailyCosts[snapshot.date] || 0) + snapshot.totalCost;
    }

    const trendData = Object.entries(dailyCosts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30) // Last 30 days
      .map(([date, cost]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        cost,
      }));

    return {
      serviceChartData: serviceData,
      trendChartData: trendData,
      currentMonthTotal: currTotal,
      previousMonthTotal: prevTotal,
    };
  }, [costSnapshots]);

  // Calculate cost change percentage
  const costChangePercent = previousMonthTotal > 0
    ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
    : 0;

  // Get all open recommendations
  const openRecommendations = useMemo(() => {
    if (!recommendations) return [];
    return recommendations
      .filter((r) => r.status === "open")
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }, [recommendations]);

  // Group recommendations by category
  const groupedRecommendations = useMemo(() => {
    return RECOMMENDATION_CATEGORIES.map((category) => ({
      ...category,
      recommendations: openRecommendations.filter((r) =>
        category.types.includes(r.type)
      ),
      totalSavings: openRecommendations
        .filter((r) => category.types.includes(r.type))
        .reduce((sum, r) => sum + r.estimatedSavings, 0),
    })).filter((group) => group.recommendations.length > 0);
  }, [openRecommendations]);

  // Calculate total potential savings
  const totalPotentialSavings = useMemo(() => {
    return openRecommendations.reduce((sum, r) => sum + r.estimatedSavings, 0);
  }, [openRecommendations]);

  const hasRecommendations = openRecommendations.length > 0;
  const isLoading = costSnapshots === undefined || recommendations === undefined || !isOrgReady;

  // Show loading state while waiting for authentication or organization
  if (isSessionPending || (isAuthenticated && !isOrgReady)) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="dashboard-page-loading">
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
      <Center h="calc(100vh - 120px)" data-testid="dashboard-page-unauthenticated">
        <Paper p="xl" ta="center" withBorder>
          <IconUser size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            Please sign in to continue
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be signed in to view the dashboard.
          </Text>
          <Button component="a" href="/login" mt="md">
            Sign In
          </Button>
        </Paper>
      </Center>
    );
  }

  // Show message if user has no organization (skip in test mode - test mode always has an organization)
  if (!IS_TEST_MODE && !isLoadingOrg && !activeOrganization) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="dashboard-page-no-org">
        <Paper p="xl" ta="center" withBorder>
          <IconCloud size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            No Organization Found
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be a member of an organization to view the dashboard.
          </Text>
        </Paper>
      </Center>
    );
  }

  // Show onboarding state when no AWS accounts are connected
  if (!isLoading && summary && summary.totalAccounts === 0) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="dashboard-page-no-accounts">
        <Paper p="xl" ta="center" withBorder maw={500}>
          <Stack align="center" gap="lg">
            <ThemeIcon variant="light" color="blue" size={80} radius="xl">
              <IconCloud size={40} />
            </ThemeIcon>
            <Stack gap="xs" align="center">
              <Title order={3}>Get Started with AWS Optimizer</Title>
              <Text c="dimmed" size="sm" maw={400}>
                Connect your first AWS account to start tracking costs and
                discovering optimization opportunities.
              </Text>
            </Stack>
            <Button
              size="md"
              leftSection={<IconCloud size={18} />}
              onClick={() => navigate({ to: "/accounts" })}
            >
              Connect AWS Account
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Container data-testid="dashboard-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Dashboard</Title>
            <Text c="dimmed" size="sm">
              Overview of your AWS costs and optimization opportunities
            </Text>
          </Stack>
          <Badge
            data-testid="account-aggregation"
            variant="light"
            color="blue"
            size="lg"
            leftSection={<IconCloud size={14} />}
          >
            {summary?.totalAccounts ?? 0} Account{(summary?.totalAccounts ?? 0) !== 1 ? "s" : ""} Connected
          </Badge>
        </Group>

        {/* ── Connected Accounts ── */}
        {connectedAccounts && connectedAccounts.length > 0 && (
          <Paper data-testid="connected-accounts" withBorder p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="md">
                  <IconCloud size={18} />
                </ThemeIcon>
                <Title order={3}>Connected Accounts</Title>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {connectedAccounts.map((account) => (
                  <Paper key={account._id} withBorder p="sm" radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>{account.name}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">{account.accountNumber}</Text>
                      </Stack>
                      <Badge
                        size="sm"
                        variant="dot"
                        color={account.status === "active" ? "green" : "gray"}
                      >
                        {account.status}
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
        )}

        {/* ── Cost Overview ── */}
        <Stack gap="sm">
          <Group gap="xs">
            <ThemeIcon variant="light" color="green" size="md">
              <IconCurrencyDollar size={18} />
            </ThemeIcon>
            <Title order={3}>Cost Overview</Title>
          </Group>

          <Paper data-testid="cost-overview" withBorder p="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              {/* Current Month Cost */}
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="blue" size="sm">
                    <IconCoin size={14} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    Current Month
                  </Text>
                </Group>
                {isLoading ? (
                  <Skeleton height={36} />
                ) : (
                  <Text data-testid="current-month-cost" size="xl" fw={700}>
                    {formatCurrency(currentMonthTotal || summary?.currentMonthCost || 0)}
                  </Text>
                )}
              </Stack>

              {/* Month Comparison */}
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon
                    variant="light"
                    color={costChangePercent > 0 ? "red" : costChangePercent < 0 ? "green" : "gray"}
                    size="sm"
                  >
                    {costChangePercent > 0 ? (
                      <IconTrendingUp size={14} />
                    ) : costChangePercent < 0 ? (
                      <IconTrendingDown size={14} />
                    ) : (
                      <IconMinus size={14} />
                    )}
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    vs Previous Month
                  </Text>
                </Group>
                {isLoading ? (
                  <Skeleton height={36} />
                ) : (
                  <Group gap="xs" data-testid="month-comparison">
                    <Text
                      data-testid="cost-trend-indicator"
                      size="xl"
                      fw={700}
                      c={costChangePercent > 0 ? "red" : costChangePercent < 0 ? "green" : "dimmed"}
                    >
                      {formatPercentage(costChangePercent || summary?.costChange || 0)}
                    </Text>
                    <Text size="sm" c="dimmed">
                      ({formatCurrency(previousMonthTotal || summary?.previousMonthCost || 0)})
                    </Text>
                  </Group>
                )}
              </Stack>

              {/* Open Recommendations */}
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="orange" size="sm">
                    <IconBulb size={14} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    Open Recommendations
                  </Text>
                </Group>
                {isLoading ? (
                  <Skeleton height={36} />
                ) : (
                  <Text size="xl" fw={700}>
                    {openRecommendations.length || summary?.totalOpenRecommendations || 0}
                  </Text>
                )}
              </Stack>

              {/* Potential Savings */}
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="green" size="sm">
                    <IconTrendingDown size={14} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    Potential Savings
                  </Text>
                </Group>
                {isLoading ? (
                  <Skeleton height={36} />
                ) : (
                  <Text data-testid="total-savings" size="xl" fw={700} c="green">
                    {formatCurrency(totalPotentialSavings || summary?.totalEstimatedSavings || 0)}/mo
                  </Text>
                )}
              </Stack>
            </SimpleGrid>
          </Paper>

          <Grid>
            {/* Service Breakdown Pie Chart */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper data-testid="service-breakdown" withBorder p="md" h="100%">
                <Stack gap="md">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="indigo" size="sm">
                      <IconChartPie size={14} />
                    </ThemeIcon>
                    <Title order={4}>Cost by Service</Title>
                  </Group>

                  <div data-testid="service-chart" style={{ height: 280 }}>
                    {isLoading ? (
                      <Stack align="center" justify="center" h="100%">
                        <Skeleton circle height={200} />
                      </Stack>
                    ) : serviceChartData.length > 0 ? (
                      <DonutChart
                        data={serviceChartData}
                        withLabelsLine
                        labelsType="percent"
                        withTooltip
                        tooltipDataSource="segment"
                        chartLabel={formatCurrency(currentMonthTotal)}
                        size={220}
                        thickness={35}
                        mx="auto"
                      />
                    ) : (
                      <Stack align="center" justify="center" h="100%">
                        <Text c="dimmed">No cost data available</Text>
                      </Stack>
                    )}
                  </div>

                  {/* Service Legend */}
                  {serviceChartData.length > 0 && (
                    <SimpleGrid cols={2} spacing="xs">
                      {serviceChartData.slice(0, 6).map((item) => (
                        <Group key={item.name} gap="xs" wrap="nowrap">
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              backgroundColor: `var(--mantine-color-${item.color.replace(".", "-")})`,
                              flexShrink: 0,
                            }}
                          />
                          <Text size="xs" truncate>
                            {item.name}: {formatCurrency(item.value)}
                          </Text>
                        </Group>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Cost Trend Line Chart */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper data-testid="cost-trend" withBorder p="md" h="100%">
                <Stack gap="md">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="cyan" size="sm">
                      <IconChartLine size={14} />
                    </ThemeIcon>
                    <Title order={4}>Cost Trend</Title>
                  </Group>

                  <div data-testid="trend-chart" style={{ height: 280 }}>
                    {isLoading ? (
                      <Skeleton height={280} />
                    ) : trendChartData.length > 0 ? (
                      <AreaChart
                        h={280}
                        data={trendChartData}
                        dataKey="date"
                        series={[{ name: "cost", color: "cyan.6" }]}
                        curveType="monotone"
                        withDots={false}
                        withGradient
                        gridAxis="xy"
                        yAxisProps={{
                          tickFormatter: (value: number) => `$${value.toLocaleString()}`,
                        }}
                        tooltipProps={{
                          content: ({ payload }) => {
                            if (!payload || payload.length === 0) return null;
                            const data = payload[0]?.payload as { date: string; cost: number } | undefined;
                            if (!data) return null;
                            return (
                              <Paper px="md" py="sm" withBorder shadow="md" radius="md">
                                <Text size="sm" fw={500}>{data.date}</Text>
                                <Text size="sm" c="cyan">{formatCurrency(data.cost)}</Text>
                              </Paper>
                            );
                          },
                        }}
                      />
                    ) : (
                      <Stack align="center" justify="center" h="100%">
                        <Text c="dimmed">No trend data available</Text>
                      </Stack>
                    )}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>

        {/* ── Recommendations by Category ── */}
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="md">
                <IconBulb size={18} />
              </ThemeIcon>
              <Title order={3}>Recommendations</Title>
            </Group>
            {hasRecommendations && (
              <Badge variant="light" color="green" size="lg">
                Save up to {formatCurrency(totalPotentialSavings)}/mo
              </Badge>
            )}
          </Group>

          {isLoading ? (
            <Stack gap="sm">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </Stack>
          ) : hasRecommendations ? (
            <Stack gap="md" data-testid="top-recommendations">
              {groupedRecommendations.map((group) => (
                <Paper key={group.key} data-testid={`recommendation-group-${group.key}`} withBorder p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color={group.color} size="sm">
                          <group.icon size={14} />
                        </ThemeIcon>
                        <Title order={4}>{group.label}</Title>
                        <Badge variant="light" color="gray" size="sm">
                          {group.recommendations.length}
                        </Badge>
                      </Group>
                      <Badge variant="light" color="green">
                        {formatCurrency(group.totalSavings)}/mo
                      </Badge>
                    </Group>

                    <List spacing="sm" size="sm" center>
                      {group.recommendations.map((rec, index) => (
                        <List.Item
                          key={rec._id}
                          data-testid={`recommendation-item-${group.key}-${index}`}
                          icon={
                            <Badge
                              size="lg"
                              variant="filled"
                              color={getRecommendationTypeColor(rec.type)}
                              radius="sm"
                              style={{ minWidth: 100, textAlign: "center" }}
                            >
                              {getRecommendationTypeLabel(rec.type)}
                            </Badge>
                          }
                        >
                          <Group justify="space-between" wrap="nowrap" gap="md">
                            <Stack gap={2}>
                              <Text fw={500}>{rec.title}</Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {rec.description}
                              </Text>
                            </Stack>
                            <Badge size="lg" variant="light" color="green" style={{ flexShrink: 0 }}>
                              ${rec.estimatedSavings}/mo
                            </Badge>
                          </Group>
                        </List.Item>
                      ))}
                    </List>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper data-testid="top-recommendations" withBorder p="md">
              <Stack align="center" py="xl">
                <IconBulb size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No recommendations available yet.
                  <br />
                  Connect an AWS account and run an analysis to get started.
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Container>
  );
});

export default DashboardPage;
