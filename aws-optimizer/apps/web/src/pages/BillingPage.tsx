import { useCallback } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  Table,
  Progress,
  Card,
  Alert,
  Anchor,
  SimpleGrid,
  Skeleton,
  ThemeIcon,
  Divider,
} from "@mantine/core";
import {
  IconCreditCard,
  IconReceipt,
  IconCloud,
  IconChartBar,
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
  IconDownload,
  IconRocket,
  IconCalendar,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  billing: {
    getSubscription: "api.billing.getSubscription",
    getUsageStats: "api.billing.getUsageStats",
    getInvoices: "api.billing.getInvoices",
    createPortalSession: "api.billing.createPortalSession",
  },
};

interface Subscription {
  _id: string;
  plan: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  pricePerMonth: number;
  limits: {
    accounts: number;
    analysisRuns: number;
  };
}

interface UsageStats {
  accountsConnected: number;
  analysisRunsThisMonth: number;
  lastAnalysisAt: number | null;
}

interface Invoice {
  _id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  paidAt: number | null;
  invoiceUrl: string;
  invoicePdf: string;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amountInCents: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "green",
    trialing: "blue",
    past_due: "orange",
    canceled: "red",
    unpaid: "red",
    paid: "green",
    open: "yellow",
    draft: "gray",
  };
  return colors[status] || "gray";
}

function getPlanColor(plan: string): string {
  const colors: Record<string, string> = {
    free: "gray",
    starter: "blue",
    professional: "violet",
    enterprise: "orange",
  };
  return colors[plan] || "blue";
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function BillingPage() {
  // Fetch data
  const subscription = useQuery(api.billing.getSubscription) as Subscription | undefined;
  const usageStats = useQuery(api.billing.getUsageStats) as UsageStats | undefined;
  const invoices = useQuery(api.billing.getInvoices) as Invoice[] | undefined;

  // Mutations
  const createPortalSession = useMutation(api.billing.createPortalSession);

  // Calculate usage percentages
  const accountsPercentage = subscription && usageStats
    ? Math.round((usageStats.accountsConnected / subscription.limits.accounts) * 100)
    : 0;
  const analysisRunsPercentage = subscription && usageStats
    ? Math.round((usageStats.analysisRunsThisMonth / subscription.limits.analysisRuns) * 100)
    : 0;

  // Check if approaching limits (>= 80%)
  const isNearAccountLimit = accountsPercentage >= 80;
  const isNearAnalysisLimit = analysisRunsPercentage >= 80;
  const isNearAnyLimit = isNearAccountLimit || isNearAnalysisLimit;

  // Handle Stripe portal
  const handleManageSubscription = useCallback(async () => {
    const result = await createPortalSession();
    if (result?.url) {
      window.open(result.url, "_blank");
    }
  }, [createPortalSession]);

  const handleUpgrade = useCallback(async () => {
    const result = await createPortalSession();
    if (result?.url) {
      window.open(result.url, "_blank");
    }
  }, [createPortalSession]);

  const isLoading = subscription === undefined;
  const isUsageLoading = usageStats === undefined;
  const isInvoicesLoading = invoices === undefined;

  return (
    <Container data-testid="billing-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Billing</Title>
            <Text c="dimmed" size="sm">
              Manage your subscription and view usage
            </Text>
          </Stack>
        </Group>

        {/* Upgrade Alert - shown when approaching limits */}
        {isNearAnyLimit && (
          <Alert
            data-testid="upgrade-prompt"
            icon={<IconAlertTriangle size={16} />}
            title="You're approaching your plan limits"
            color="orange"
            variant="light"
          >
            <Group justify="space-between" align="center">
              <Text size="sm">
                {isNearAccountLimit && `Accounts: ${accountsPercentage}% used. `}
                {isNearAnalysisLimit && `Analysis runs: ${analysisRunsPercentage}% used. `}
                Upgrade your plan to increase your limits.
              </Text>
              <Button
                variant="filled"
                color="orange"
                size="sm"
                leftSection={<IconRocket size={16} />}
                onClick={handleUpgrade}
              >
                Upgrade Plan
              </Button>
            </Group>
          </Alert>
        )}

        {/* Current Plan Section */}
        <Paper data-testid="plan-section" withBorder p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconCreditCard size={20} />
                <Title order={4}>Current Plan</Title>
              </Group>
              <Button
                variant="light"
                leftSection={<IconExternalLink size={16} />}
                onClick={handleManageSubscription}
              >
                Manage Subscription
              </Button>
            </Group>

            {isLoading ? (
              <Stack gap="sm">
                <Skeleton height={40} />
                <Skeleton height={20} width="50%" />
              </Stack>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
                <Card withBorder padding="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Plan
                    </Text>
                    <Group gap="xs">
                      <Badge
                        data-testid="current-plan"
                        size="lg"
                        color={getPlanColor(subscription?.plan || "")}
                        variant="filled"
                      >
                        {capitalizeFirst(subscription?.plan || "Free")}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>

                <Card withBorder padding="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Status
                    </Text>
                    <Badge
                      data-testid="subscription-status"
                      size="lg"
                      color={getStatusColor(subscription?.status || "")}
                      variant="light"
                      leftSection={<IconCheck size={12} />}
                    >
                      {capitalizeFirst(subscription?.status || "Unknown")}
                    </Badge>
                  </Stack>
                </Card>

                <Card withBorder padding="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Price
                    </Text>
                    <Text data-testid="plan-price" size="xl" fw={700}>
                      ${subscription?.pricePerMonth || 0}
                      <Text span size="sm" c="dimmed" fw={400}>
                        /month
                      </Text>
                    </Text>
                  </Stack>
                </Card>

                <Card withBorder padding="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Billing Period
                    </Text>
                    <Text data-testid="billing-period" size="sm">
                      {subscription?.currentPeriodStart && subscription?.currentPeriodEnd ? (
                        <>
                          {formatDate(subscription.currentPeriodStart)} -{" "}
                          {formatDate(subscription.currentPeriodEnd)}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </Text>
                  </Stack>
                </Card>
              </SimpleGrid>
            )}
          </Stack>
        </Paper>

        {/* Usage Statistics Section */}
        <Paper data-testid="usage-stats" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconChartBar size={20} />
              <Title order={4}>Usage This Month</Title>
              {isNearAnyLimit && (
                <Badge data-testid="usage-warning" color="orange" variant="light">
                  Approaching Limits
                </Badge>
              )}
            </Group>

            {isUsageLoading ? (
              <Stack gap="sm">
                <Skeleton height={60} />
                <Skeleton height={60} />
              </Stack>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Card data-testid="accounts-connected" withBorder padding="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="blue" size="md">
                          <IconCloud size={16} />
                        </ThemeIcon>
                        <Text fw={500}>AWS Accounts Connected</Text>
                      </Group>
                      <Text fw={700}>
                        {usageStats?.accountsConnected || 0} of {subscription?.limits.accounts || 0}
                      </Text>
                    </Group>
                    <Progress
                      value={accountsPercentage}
                      color={isNearAccountLimit ? "orange" : "blue"}
                      size="lg"
                      radius="xl"
                    />
                    <Text size="xs" c="dimmed" ta="right">
                      {accountsPercentage}% used
                    </Text>
                  </Stack>
                </Card>

                <Card data-testid="analysis-runs" withBorder padding="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="violet" size="md">
                          <IconChartBar size={16} />
                        </ThemeIcon>
                        <Text fw={500}>Analysis Runs</Text>
                      </Group>
                      <Text fw={700}>
                        {usageStats?.analysisRunsThisMonth || 0} of {subscription?.limits.analysisRuns || 0}
                      </Text>
                    </Group>
                    <Progress
                      value={analysisRunsPercentage}
                      color={isNearAnalysisLimit ? "orange" : "violet"}
                      size="lg"
                      radius="xl"
                    />
                    <Text size="xs" c="dimmed" ta="right">
                      {analysisRunsPercentage}% used
                    </Text>
                  </Stack>
                </Card>
              </SimpleGrid>
            )}
          </Stack>
        </Paper>

        {/* Plan Features Section */}
        <Paper data-testid="plan-features" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconCheck size={20} />
              <Title order={4}>Plan Features</Title>
            </Group>

            {isLoading ? (
              <Skeleton height={100} />
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="green" size="sm">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Up to {subscription?.limits.accounts || 0} AWS accounts</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon variant="light" color="green" size="sm">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Up to {subscription?.limits.analysisRuns || 0} analysis runs/month</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon variant="light" color="green" size="sm">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Cost optimization recommendations</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon variant="light" color="green" size="sm">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Detailed cost reports</Text>
                </Group>
              </SimpleGrid>
            )}
          </Stack>
        </Paper>

        {/* Stripe Portal Section */}
        <Paper data-testid="stripe-portal-section" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconCreditCard size={20} />
              <Title order={4}>Payment & Subscription Management</Title>
            </Group>

            <Text size="sm" c="dimmed">
              Manage your subscription, update your payment method, and download invoices through the Stripe Customer Portal.
            </Text>

            <Group gap="md">
              <Button
                variant="light"
                leftSection={<IconCreditCard size={16} />}
                onClick={handleManageSubscription}
              >
                Update Payment Method
              </Button>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconCalendar size={16} />}
                onClick={handleManageSubscription}
              >
                Change Billing Cycle
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Invoice History Section */}
        <Paper data-testid="invoice-history" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconReceipt size={20} />
              <Title order={4}>Invoice History</Title>
            </Group>

            {isInvoicesLoading ? (
              <Stack gap="sm">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={50} />
                ))}
              </Stack>
            ) : invoices && invoices.length === 0 ? (
              <Stack align="center" py="xl">
                <IconReceipt size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No invoices yet.
                  <br />
                  Your invoices will appear here after your first billing cycle.
                </Text>
              </Stack>
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Invoice Number</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoices?.map((invoice) => (
                    <Table.Tr key={invoice._id}>
                      <Table.Td>
                        <Text fw={500}>{invoice.number}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(invoice.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{formatCurrency(invoice.amount, invoice.currency)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusColor(invoice.status)}
                          variant="light"
                        >
                          {capitalizeFirst(invoice.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Anchor
                            href={invoice.invoiceUrl}
                            target="_blank"
                            size="sm"
                          >
                            <Group gap={4}>
                              <IconExternalLink size={14} />
                              View
                            </Group>
                          </Anchor>
                          <Divider orientation="vertical" />
                          <Anchor
                            href={invoice.invoicePdf}
                            target="_blank"
                            size="sm"
                          >
                            <Group gap={4}>
                              <IconDownload size={14} />
                              PDF
                            </Group>
                          </Anchor>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default BillingPage;
