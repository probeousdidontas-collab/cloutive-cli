import { useMemo, useCallback, useState } from "react";
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
  Modal,
  TextInput,
  Box,
  Radio,
  Switch,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBuilding,
  IconCloud,
  IconBell,
  IconCoin,
  IconUsers,
  IconArrowRight,
  IconBriefcase,
  IconPlus,
  IconBulb,
  IconTrendingDown,
  IconFileText,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "../lib/notifications";
import { useSession } from "../lib/auth-client";

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
  totalSavings: number;
  recommendationCount: number;
}

type AggregateReportType = "summary" | "detailed" | "savings" | "comparison";

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
  const { data: session } = useSession();
  
  // Get user ID from session for partner operations
  const userId = session?.user?.id as Id<"users"> | undefined;

  // Modal state
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [reportModalOpened, { open: openReportModal, close: closeReportModal }] = useDisclosure(false);
  const [orgName, setOrgName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  
  // Report form state
  const [reportType, setReportType] = useState<AggregateReportType>("summary");
  const [includeAllClients, setIncludeAllClients] = useState(true);
  const [anonymize, setAnonymize] = useState(false);

  // Fetch client organizations
  // These APIs require partnerId from the authenticated user
  const clientOrganizationsData = useQuery(
    api.partner.listClientOrganizations,
    userId ? { partnerId: userId } : "skip"
  );
  const clientOrganizations = clientOrganizationsData as ClientOrganization[] | undefined;

  // Mutation for creating client org
  const createClientOrg = useMutation(api.partner.createClientOrganization);
  
  // Mutation for generating aggregate report
  const generateAggregateReport = useMutation(api.partner.generateAggregateReport);

  // Reset form
  const resetForm = useCallback(() => {
    setOrgName("");
    setClientEmail("");
  }, []);

  // Reset report form
  const resetReportForm = useCallback(() => {
    setReportType("summary");
    setIncludeAllClients(true);
    setAnonymize(false);
  }, []);

  // Handle create client org
  const handleCreateClientOrg = useCallback(async () => {
    if (!userId) {
      showErrorToast("User not authenticated");
      return;
    }
    try {
      await createClientOrg({
        partnerId: userId,
        organizationName: orgName,
        clientEmail: clientEmail,
      });
      showSuccessToast(`Client organization "${orgName}" created`);
      closeModal();
      resetForm();
    } catch {
      showErrorToast("Failed to create client organization");
    }
  }, [userId, orgName, clientEmail, createClientOrg, closeModal, resetForm]);

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    if (!clientOrganizations) {
      return {
        totalClients: 0,
        totalAccounts: 0,
        totalCost: 0,
        totalAlerts: 0,
        totalSavings: 0,
        totalRecommendations: 0,
      };
    }

    return clientOrganizations.reduce(
      (acc, org) => ({
        totalClients: acc.totalClients + 1,
        totalAccounts: acc.totalAccounts + org.accountCount,
        totalCost: acc.totalCost + org.totalCost,
        totalAlerts: acc.totalAlerts + org.alertCount,
        totalSavings: acc.totalSavings + (org.totalSavings || 0),
        totalRecommendations: acc.totalRecommendations + (org.recommendationCount || 0),
      }),
      { totalClients: 0, totalAccounts: 0, totalCost: 0, totalAlerts: 0, totalSavings: 0, totalRecommendations: 0 }
    );
  }, [clientOrganizations]);

  // Calculate savings percentage
  const savingsPercentage = useMemo(() => {
    if (aggregateStats.totalCost === 0) return 0;
    return (aggregateStats.totalSavings / aggregateStats.totalCost) * 100;
  }, [aggregateStats]);

  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    if (!userId) {
      showErrorToast("User not authenticated");
      return;
    }
    try {
      await generateAggregateReport({
        partnerId: userId,
        reportType,
        includeAllClients,
        clientIds: undefined, // Include all clients when includeAllClients is true
        anonymize,
      });
      showSuccessToast("Report generation started");
      closeReportModal();
      resetReportForm();
    } catch {
      showErrorToast("Failed to generate report");
    }
  }, [userId, reportType, includeAllClients, anonymize, generateAggregateReport, closeReportModal, resetReportForm]);

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
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openModal}
          >
            Create Client Org
          </Button>
        </Group>

        {/* Aggregate Stats */}
        <Paper data-testid="aggregate-stats" withBorder p="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
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

            {/* Total Savings */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="teal" size="sm">
                  <IconTrendingDown size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Potential Savings
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-savings" size="xl" fw={700} c="teal">
                  {formatCurrency(aggregateStats.totalSavings)}/mo
                </Text>
              )}
            </Stack>

            {/* Total Recommendations */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="orange" size="sm">
                  <IconBulb size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Recommendations
                </Text>
              </Group>
              {isLoading ? (
                <Skeleton height={36} />
              ) : (
                <Text data-testid="total-recommendations" size="xl" fw={700}>
                  {aggregateStats.totalRecommendations}
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

          {/* Savings Percentage Bar */}
          {!isLoading && aggregateStats.totalCost > 0 && (
            <>
              <Divider my="md" />
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Savings Opportunity:
                  </Text>
                  <Badge
                    data-testid="savings-percentage"
                    variant="light"
                    color="teal"
                    size="lg"
                  >
                    {savingsPercentage.toFixed(1)}% of spend
                  </Badge>
                </Group>
                <Button
                  variant="light"
                  color="violet"
                  leftSection={<IconFileText size={16} />}
                  onClick={openReportModal}
                >
                  Generate Aggregate Report
                </Button>
              </Group>
            </>
          )}
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
                      <SimpleGrid cols={4} spacing="xs">
                        {/* Cost */}
                        <Stack gap={2} align="center">
                          <Text size="xs" c="dimmed">
                            Cost
                          </Text>
                          <Text fw={600} size="sm">
                            {formatCurrency(org.totalCost)}
                          </Text>
                        </Stack>

                        {/* Savings */}
                        <Stack gap={2} align="center">
                          <Text size="xs" c="dimmed">
                            Savings
                          </Text>
                          <Text
                            data-testid="org-savings"
                            fw={600}
                            size="sm"
                            c="teal"
                          >
                            {formatCurrency(org.totalSavings || 0)}
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

      {/* Create Client Org Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          closeModal();
          resetForm();
        }}
        title="Create Client Organization"
        size="md"
        data-testid="create-client-org-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Organization Name"
            placeholder="Acme Corp"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />

          <TextInput
            label="Primary Contact Email"
            placeholder="client@example.com"
            description="An invitation will be sent to this email. They will become the organization owner."
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            type="email"
            required
          />

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeModal();
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClientOrg}
              disabled={!orgName.trim() || !clientEmail.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Aggregate Report Modal */}
      <Modal
        opened={reportModalOpened}
        onClose={() => {
          closeReportModal();
          resetReportForm();
        }}
        title="Generate Aggregate Report"
        size="md"
        data-testid="aggregate-report-modal"
      >
        <Stack gap="md">
          <Box data-testid="report-type-selector">
            <Text size="sm" fw={500} mb={4}>
              Report Type
            </Text>
            <Radio.Group
              value={reportType}
              onChange={(value) => setReportType(value as AggregateReportType)}
            >
              <Stack gap="xs">
                <Radio value="summary" label="Summary" />
                <Radio value="detailed" label="Detailed" />
                <Radio value="savings" label="Savings Analysis" />
                <Radio value="comparison" label="Client Comparison" />
              </Stack>
            </Radio.Group>
          </Box>

          <Box data-testid="client-selection">
            <Text size="sm" fw={500} mb={4}>
              Client Selection
            </Text>
            <Switch
              label="Include all clients"
              checked={includeAllClients}
              onChange={(e) => setIncludeAllClients(e.currentTarget.checked)}
            />
            {!includeAllClients && (
              <Text size="xs" c="dimmed" mt="xs">
                Select specific clients in the list below (feature coming soon)
              </Text>
            )}
          </Box>

          <Box data-testid="anonymize-option">
            <Switch
              label="Anonymize client data"
              description="Replace client names with generic identifiers (Client A, Client B, etc.)"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.currentTarget.checked)}
            />
          </Box>

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeReportModal();
                resetReportForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateReport}>
              Generate Report
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default PartnerPage;
