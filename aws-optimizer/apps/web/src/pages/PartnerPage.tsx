import { useMemo, useCallback } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  Card,
  SimpleGrid,
  ThemeIcon,
  Skeleton,
  Divider,
} from "@mantine/core";
import {
  IconBuilding,
  IconCloud,
  IconBell,
  IconCoin,
  IconUsers,
  IconArrowRight,
  IconBriefcase,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { useNavigate } from "@tanstack/react-router";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  partner: {
    listClientOrganizations: "api.partner.listClientOrganizations",
  },
};

interface ClientOrganization {
  _id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  totalCost: number;
  accountCount: number;
  alertCount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPlanColor(plan: string): string {
  const colors: Record<string, string> = {
    free: "gray",
    starter: "blue",
    professional: "violet",
    enterprise: "orange",
  };
  return colors[plan] || "gray";
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function PartnerPage() {
  const navigate = useNavigate();

  // Fetch client organizations
  const clientOrganizations = useQuery(api.partner.listClientOrganizations) as ClientOrganization[] | undefined;

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    if (!clientOrganizations) {
      return {
        totalClients: 0,
        totalAccounts: 0,
        totalCost: 0,
        totalAlerts: 0,
      };
    }

    return clientOrganizations.reduce(
      (acc, org) => ({
        totalClients: acc.totalClients + 1,
        totalAccounts: acc.totalAccounts + org.accountCount,
        totalCost: acc.totalCost + org.totalCost,
        totalAlerts: acc.totalAlerts + org.alertCount,
      }),
      { totalClients: 0, totalAccounts: 0, totalCost: 0, totalAlerts: 0 }
    );
  }, [clientOrganizations]);

  // Handle switching to client org context
  const handleManageOrg = useCallback(
    (org: ClientOrganization) => {
      // Navigate to the client org's dashboard
      navigate({ to: "/dashboard", search: { org: org.slug } });
    },
    [navigate]
  );

  const isLoading = clientOrganizations === undefined;

  return (
    <Container data-testid="partner-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header with Partner Indicator */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>Partner Dashboard</Title>
              <Badge
                data-testid="partner-indicator"
                variant="gradient"
                gradient={{ from: "violet", to: "indigo", deg: 90 }}
                size="lg"
                leftSection={<IconBriefcase size={14} />}
              >
                Partner View
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Manage all your client organizations from one place
            </Text>
          </Stack>
        </Group>

        {/* Aggregate Stats */}
        <Paper withBorder p="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {/* Total Clients */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="violet" size="sm">
                  <IconBuilding size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Total Clients
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-clients" size="xl" fw={700}>
                  {aggregateStats.totalClients}
                </Text>
              )}
            </Stack>

            {/* Total Accounts */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="sm">
                  <IconCloud size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Total Accounts
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-accounts" size="xl" fw={700}>
                  {aggregateStats.totalAccounts}
                </Text>
              )}
            </Stack>

            {/* Total Cost */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="green" size="sm">
                  <IconCoin size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Total Cost (MTD)
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-cost" size="xl" fw={700}>
                  {formatCurrency(aggregateStats.totalCost)}
                </Text>
              )}
            </Stack>

            {/* Total Alerts */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="red" size="sm">
                  <IconBell size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Active Alerts
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-alerts" size="xl" fw={700}>
                  {aggregateStats.totalAlerts}
                </Text>
              )}
            </Stack>
          </SimpleGrid>
        </Paper>

        {/* Client Organizations List */}
        <Paper data-testid="client-orgs-list" withBorder p="md">
          <Stack gap="md">
            <Group gap="xs">
              <IconUsers size={20} />
              <Title order={4}>Client Organizations</Title>
              {!isLoading && clientOrganizations && (
                <Badge variant="light" color="gray">
                  {clientOrganizations.length} client{clientOrganizations.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </Group>

            <Divider />

            {isLoading ? (
              <Stack gap="md">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={120} />
                ))}
              </Stack>
            ) : clientOrganizations && clientOrganizations.length === 0 ? (
              <Stack align="center" py="xl">
                <IconBuilding size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No client organizations yet.
                  <br />
                  Add your first client to get started.
                </Text>
              </Stack>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                {clientOrganizations?.map((org) => (
                  <Card
                    key={org._id}
                    data-testid={`org-item-${org._id}`}
                    withBorder
                    padding="lg"
                    radius="md"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleManageOrg(org)}
                  >
                    <Stack gap="md">
                      {/* Org Header */}
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4}>
                          <Text fw={600} size="lg">
                            {org.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {org.slug}
                          </Text>
                        </Stack>
                        <Badge
                          variant="light"
                          color={getPlanColor(org.plan)}
                        >
                          {capitalizeFirst(org.plan)}
                        </Badge>
                      </Group>

                      {/* Org Stats */}
                      <SimpleGrid cols={3} spacing="xs">
                        {/* Cost */}
                        <Stack gap={2} align="center">
                          <Text size="xs" c="dimmed">
                            Cost
                          </Text>
                          <Text fw={600} size="sm">
                            {formatCurrency(org.totalCost)}
                          </Text>
                        </Stack>

                        {/* Accounts */}
                        <Stack gap={2} align="center">
                          <Text size="xs" c="dimmed">
                            Accounts
                          </Text>
                          <Text
                            data-testid="account-count"
                            fw={600}
                            size="sm"
                          >
                            {org.accountCount}
                          </Text>
                        </Stack>

                        {/* Alerts */}
                        <Stack gap={2} align="center">
                          <Text size="xs" c="dimmed">
                            Alerts
                          </Text>
                          <Badge
                            data-testid="alert-count"
                            variant={org.alertCount > 0 ? "filled" : "light"}
                            color={org.alertCount > 0 ? "red" : "gray"}
                            size="sm"
                          >
                            {org.alertCount}
                          </Badge>
                        </Stack>
                      </SimpleGrid>

                      {/* Manage Button */}
                      <Button
                        variant="light"
                        color="violet"
                        fullWidth
                        rightSection={<IconArrowRight size={16} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageOrg(org);
                        }}
                      >
                        Manage
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default PartnerPage;
