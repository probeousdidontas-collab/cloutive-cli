import { useState, useMemo, useCallback } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Modal,
  TextInput,
  NumberInput,
  SegmentedControl,
  Checkbox,
  Select,
  Badge,
  Progress,
  ActionIcon,
  Tooltip,
  Skeleton,
  SimpleGrid,
  Box,
  Divider,
  Radio,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconPigMoney,
  IconEdit,
  IconTrash,
  IconBuilding,
  IconCloud,
  IconAlertTriangle,
  IconUser,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { observer } from "mobx-react-lite";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { useSession, IS_TEST_MODE } from "../lib/auth-client";
import { useOrganization } from "../hooks/useOrganization";

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

interface Budget {
  _id: string;
  name: string;
  amount: number;
  period: "monthly" | "quarterly" | "yearly";
  alertThresholds: number[];
  currentSpend: number;
  scope: "organization" | "account";
  awsAccountId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  status: string;
}

type BudgetPeriod = "monthly" | "quarterly" | "yearly";
type BudgetScope = "organization" | "account";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getProgressColor(percentage: number, thresholds: number[]): string {
  const sortedThresholds = [...thresholds].sort((a, b) => b - a);
  
  for (const threshold of sortedThresholds) {
    if (percentage >= threshold) {
      if (threshold >= 100) return "red";
      if (threshold >= 80) return "orange";
      if (threshold >= 50) return "yellow";
    }
  }
  
  return "blue";
}

function getExceededThreshold(percentage: number, thresholds: number[]): number | null {
  const sortedThresholds = [...thresholds].sort((a, b) => b - a);
  
  for (const threshold of sortedThresholds) {
    if (percentage >= threshold) {
      return threshold;
    }
  }
  
  return null;
}

const DEFAULT_THRESHOLDS = [50, 80, 100];

export const BudgetsPage = observer(function BudgetsPage() {
  const { data: session, isPending: isSessionPending } = useSession();

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

  // Modal states
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  
  // Form states
  const [budgetName, setBudgetName] = useState("");
  const [budgetAmount, setBudgetAmount] = useState<number | string>(0);
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("monthly");
  const [budgetScope, setBudgetScope] = useState<BudgetScope>("organization");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedThresholds, setSelectedThresholds] = useState<number[]>([50, 80, 100]);
  
  // Selected budget for edit/delete
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  // In test mode, use empty args (backend handles test mode)
  // Otherwise, pass the Convex organization ID
  const shouldQueryBudgets = isAuthenticated && isOrgReady && (IS_TEST_MODE || organizationId);
  
  // Fetch data - pass organization ID for proper multi-org support
  const budgets = useQuery(
    api.budgets.list,
    shouldQueryBudgets
      ? IS_TEST_MODE
        ? {}
        : { organizationId: organizationId! }
      : "skip"
  ) as Budget[] | undefined;
  const accountsData = useQuery(
    api.awsAccounts.listByOrganization,
    shouldQueryBudgets && organizationId
      ? { organizationId }
      : "skip"
  );
  const accounts = accountsData as AwsAccount[] | undefined;
  
  // Mutations
  const createBudget = useMutation(api.budgets.create);
  const updateBudget = useMutation(api.budgets.update);
  const deleteBudget = useMutation(api.budgets.remove);
  
  // Account options for select
  const accountOptions = useMemo(() => {
    if (!accounts) return [];
    return accounts.map((a) => ({
      value: a._id,
      label: `${a.name} (${a.accountNumber})`,
    }));
  }, [accounts]);
  
  // Get account name by ID
  const getAccountName = useCallback(
    (accountId: string | null): string => {
      if (!accountId) return "Organization";
      const account = accounts?.find((a) => a._id === accountId);
      return account?.name || accountId;
    },
    [accounts]
  );
  
  // Reset form
  const resetForm = useCallback(() => {
    setBudgetName("");
    setBudgetAmount(0);
    setBudgetPeriod("monthly");
    setBudgetScope("organization");
    setSelectedAccountId(null);
    setSelectedThresholds([50, 80, 100]);
  }, []);
  
  // Handle create budget
  const handleCreateBudget = useCallback(async () => {
    await createBudget({
      name: budgetName,
      amount: Number(budgetAmount),
      period: budgetPeriod,
      alertThresholds: selectedThresholds,
      scope: budgetScope,
      awsAccountId: budgetScope === "account" ? selectedAccountId as Id<"awsAccounts"> : null,
    });
    closeCreateModal();
    resetForm();
  }, [budgetName, budgetAmount, budgetPeriod, selectedThresholds, budgetScope, selectedAccountId, createBudget, closeCreateModal, resetForm]);
  
  // Handle edit click
  const handleEditClick = useCallback((budget: Budget) => {
    setSelectedBudget(budget);
    setBudgetName(budget.name);
    setBudgetAmount(budget.amount);
    setBudgetPeriod(budget.period);
    setBudgetScope(budget.scope);
    setSelectedAccountId(budget.awsAccountId);
    setSelectedThresholds(budget.alertThresholds);
    openEditModal();
  }, [openEditModal]);
  
  // Handle update budget
  const handleUpdateBudget = useCallback(async () => {
    if (!selectedBudget) return;
    await updateBudget({
      id: selectedBudget._id as Id<"budgets">,
      name: budgetName,
      amount: Number(budgetAmount),
      period: budgetPeriod,
      alertThresholds: selectedThresholds,
      scope: budgetScope,
      awsAccountId: budgetScope === "account" ? selectedAccountId as Id<"awsAccounts"> : null,
    });
    closeEditModal();
    resetForm();
    setSelectedBudget(null);
  }, [selectedBudget, budgetName, budgetAmount, budgetPeriod, selectedThresholds, budgetScope, selectedAccountId, updateBudget, closeEditModal, resetForm]);
  
  // Handle delete click
  const handleDeleteClick = useCallback((budget: Budget) => {
    setSelectedBudget(budget);
    openDeleteModal();
  }, [openDeleteModal]);
  
  // Handle confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedBudget) return;
    await deleteBudget({ id: selectedBudget._id as Id<"budgets"> });
    closeDeleteModal();
    setSelectedBudget(null);
  }, [selectedBudget, deleteBudget, closeDeleteModal]);
  
  // Handle threshold toggle
  const handleThresholdToggle = useCallback((threshold: number) => {
    setSelectedThresholds((prev) => {
      if (prev.includes(threshold)) {
        return prev.filter((t) => t !== threshold);
      }
      return [...prev, threshold].sort((a, b) => a - b);
    });
  }, []);
  
  const isLoading = budgets === undefined || accounts === undefined;

  // Show loading state while waiting for authentication or organization
  if (isSessionPending || (isAuthenticated && !isOrgReady)) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="budgets-page-loading">
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
      <Center h="calc(100vh - 120px)" data-testid="budgets-page-unauthenticated">
        <Paper p="xl" ta="center" withBorder>
          <IconUser size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            Please sign in to continue
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be signed in to manage budgets.
          </Text>
          <Button component="a" href="/login" mt="md">
            Sign In
          </Button>
        </Paper>
      </Center>
    );
  }

  // Show message if user has no organization (skip in test mode)
  if (!IS_TEST_MODE && !isLoadingOrg && !activeOrganization) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="budgets-page-no-org">
        <Paper p="xl" ta="center" withBorder>
          <IconCloud size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            No Organization Found
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be a member of an organization to manage budgets.
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <Container data-testid="budgets-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Budgets</Title>
            <Text c="dimmed" size="sm">
              Set spending limits and track costs against your budgets
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            Create Budget
          </Button>
        </Group>

        {/* Budget List */}
        <Box data-testid="budgets-list">
          {isLoading ? (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={200} radius="md" />
              ))}
            </SimpleGrid>
          ) : budgets && budgets.length === 0 ? (
            <Paper withBorder p="xl">
              <Stack align="center" gap="md">
                <IconPigMoney size={48} opacity={0.5} />
                <Text c="dimmed" ta="center">
                  No budgets configured yet.
                  <br />
                  Create your first budget to start tracking spending.
                </Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={openCreateModal}
                >
                  Create Budget
                </Button>
              </Stack>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {budgets?.map((budget) => {
                const percentage = Math.round((budget.currentSpend / budget.amount) * 100);
                const progressColor = getProgressColor(percentage, budget.alertThresholds);
                const exceededThreshold = getExceededThreshold(percentage, budget.alertThresholds);
                
                return (
                  <Paper
                    key={budget._id}
                    data-testid={`budget-card-${budget._id}`}
                    withBorder
                    p="md"
                    radius="md"
                  >
                    <Stack gap="md">
                      {/* Budget Header */}
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4}>
                          <Group gap="xs">
                            <Text fw={600} size="lg">
                              {budget.name}
                            </Text>
                            {exceededThreshold && (
                              <Tooltip label={`Exceeded ${exceededThreshold}% threshold`}>
                                <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
                              </Tooltip>
                            )}
                          </Group>
                          <Group gap="xs">
                            <Badge
                              size="sm"
                              variant="light"
                              color={
                                budget.period === "monthly"
                                  ? "blue"
                                  : budget.period === "quarterly"
                                    ? "violet"
                                    : "teal"
                              }
                            >
                              {budget.period}
                            </Badge>
                            <Badge
                              size="sm"
                              variant="outline"
                              leftSection={
                                budget.scope === "organization" ? (
                                  <IconBuilding size={12} />
                                ) : (
                                  <IconCloud size={12} />
                                )
                              }
                            >
                              {budget.scope === "organization"
                                ? "Organization"
                                : getAccountName(budget.awsAccountId)}
                            </Badge>
                          </Group>
                        </Stack>
                        <Group gap={4}>
                          <Tooltip label="Edit budget">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => handleEditClick(budget)}
                              aria-label="Edit"
                            >
                              <IconEdit size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete budget">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteClick(budget)}
                              aria-label="Delete"
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>

                      {/* Spend vs Budget */}
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Current Spend
                          </Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(budget.currentSpend)} / {formatCurrency(budget.amount)}
                          </Text>
                        </Group>
                        <Progress
                          data-testid={`budget-progress-${budget._id}`}
                          value={Math.min(percentage, 100)}
                          color={progressColor}
                          size="lg"
                          radius="xl"
                        />
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">
                            {percentage}% used
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatCurrency(Math.max(budget.amount - budget.currentSpend, 0))} remaining
                          </Text>
                        </Group>
                      </Stack>

                      {/* Thresholds */}
                      <Box data-testid={`budget-thresholds-${budget._id}`}>
                        <Text size="xs" c="dimmed" mb={4}>
                          Alert Thresholds
                        </Text>
                        <Group gap={4}>
                          {budget.alertThresholds.map((threshold) => (
                            <Badge
                              key={threshold}
                              size="xs"
                              variant={percentage >= threshold ? "filled" : "light"}
                              color={
                                threshold >= 100
                                  ? "red"
                                  : threshold >= 80
                                    ? "orange"
                                    : threshold >= 50
                                      ? "yellow"
                                      : "blue"
                              }
                            >
                              {threshold}%
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </Stack>

      {/* Create Budget Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create Budget"
        size="md"
        data-testid="create-budget-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Budget Name"
            placeholder="e.g., Monthly Cloud Budget"
            value={budgetName}
            onChange={(e) => setBudgetName(e.target.value)}
            required
          />
          
          <NumberInput
            label="Amount"
            placeholder="10000"
            value={budgetAmount}
            onChange={setBudgetAmount}
            min={0}
            prefix="$"
            thousandSeparator=","
            required
          />
          
          <Box data-testid="period-selector">
            <Text size="sm" fw={500} mb={4}>
              Budget Period
            </Text>
            <SegmentedControl
              fullWidth
              value={budgetPeriod}
              onChange={(value) => setBudgetPeriod(value as BudgetPeriod)}
              data={[
                { label: "Monthly", value: "monthly" },
                { label: "Quarterly", value: "quarterly" },
                { label: "Yearly", value: "yearly" },
              ]}
            />
          </Box>
          
          <Box data-testid="scope-selector">
            <Text size="sm" fw={500} mb={4}>
              Budget Scope
            </Text>
            <Radio.Group
              value={budgetScope}
              onChange={(value) => setBudgetScope(value as BudgetScope)}
            >
              <Stack gap="xs">
                <Radio value="organization" label="Organization" />
                <Radio value="account" label="Specific Account" />
              </Stack>
            </Radio.Group>
          </Box>
          
          {budgetScope === "account" && (
            <Box data-testid="account-selector">
              <Select
                label="AWS Account"
                placeholder="Select an account"
                data={accountOptions}
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                required
              />
            </Box>
          )}
          
          <Box data-testid="threshold-selector">
            <Text size="sm" fw={500} mb={4}>
              Alert Thresholds
            </Text>
            <Text size="xs" c="dimmed" mb="xs">
              Receive alerts when spend reaches these percentages
            </Text>
            <Group gap="md">
              {DEFAULT_THRESHOLDS.map((threshold) => (
                <Checkbox
                  key={threshold}
                  label={`${threshold}%`}
                  checked={selectedThresholds.includes(threshold)}
                  onChange={() => handleThresholdToggle(threshold)}
                />
              ))}
            </Group>
          </Box>
          
          <Divider />
          
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBudget}
              disabled={!budgetName || !budgetAmount || (budgetScope === "account" && !selectedAccountId)}
            >
              Create Budget
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => {
          closeEditModal();
          resetForm();
          setSelectedBudget(null);
        }}
        title="Edit Budget"
        size="md"
        data-testid="edit-budget-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Budget Name"
            placeholder="e.g., Monthly Cloud Budget"
            value={budgetName}
            onChange={(e) => setBudgetName(e.target.value)}
            required
          />
          
          <NumberInput
            label="Amount"
            placeholder="10000"
            value={budgetAmount}
            onChange={setBudgetAmount}
            min={0}
            prefix="$"
            thousandSeparator=","
            required
          />
          
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Budget Period
            </Text>
            <SegmentedControl
              fullWidth
              value={budgetPeriod}
              onChange={(value) => setBudgetPeriod(value as BudgetPeriod)}
              data={[
                { label: "Monthly", value: "monthly" },
                { label: "Quarterly", value: "quarterly" },
                { label: "Yearly", value: "yearly" },
              ]}
            />
          </Box>
          
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Budget Scope
            </Text>
            <Radio.Group
              value={budgetScope}
              onChange={(value) => setBudgetScope(value as BudgetScope)}
            >
              <Stack gap="xs">
                <Radio value="organization" label="Organization" />
                <Radio value="account" label="Specific Account" />
              </Stack>
            </Radio.Group>
          </Box>
          
          {budgetScope === "account" && (
            <Select
              label="AWS Account"
              placeholder="Select an account"
              data={accountOptions}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              required
            />
          )}
          
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Alert Thresholds
            </Text>
            <Group gap="md">
              {DEFAULT_THRESHOLDS.map((threshold) => (
                <Checkbox
                  key={threshold}
                  label={`${threshold}%`}
                  checked={selectedThresholds.includes(threshold)}
                  onChange={() => handleThresholdToggle(threshold)}
                />
              ))}
            </Group>
          </Box>
          
          <Divider />
          
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeEditModal();
                resetForm();
                setSelectedBudget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateBudget}
              disabled={!budgetName || !budgetAmount || (budgetScope === "account" && !selectedAccountId)}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setSelectedBudget(null);
        }}
        title="Delete Budget"
        size="sm"
        data-testid="confirm-delete-modal"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete the budget{" "}
            <Text span fw={600}>
              "{selectedBudget?.name}"
            </Text>
            ?
          </Text>
          <Text size="sm" c="dimmed">
            This action cannot be undone. All alert configurations for this budget will be removed.
          </Text>
          
          <Divider />
          
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeDeleteModal();
                setSelectedBudget(null);
              }}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmDelete}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
});

export default BudgetsPage;
