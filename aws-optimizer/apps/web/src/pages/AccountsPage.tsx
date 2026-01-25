import { useState, useMemo } from "react";
import {
  Group,
  Stack,
  Title,
  Text,
  Button,
  Paper,
  Badge,
  Table,
  Modal,
  TextInput,
  Tabs,
  Alert,
  ActionIcon,
  Tooltip,
  Code,
  CopyButton,
  Divider,
  Container,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconCloud,
  IconKey,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconDownload,
  IconCopy,
  IconRefresh,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { useSession } from "../lib/auth-client";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  awsAccounts: {
    listByOrganization: "api.awsAccounts.listByOrganization",
    connectWithRole: "api.awsAccounts.connectWithRole",
    connectWithKeys: "api.awsAccounts.connectWithKeys",
    disconnect: "api.awsAccounts.disconnect",
    verifyRoleConnection: "api.awsAccounts.verifyRoleConnection",
    verifyKeyConnection: "api.awsAccounts.verifyKeyConnection",
    generateCloudFormationTemplate: "api.awsAccounts.generateCloudFormationTemplate",
  },
};

type AwsAccountStatus = "active" | "inactive" | "pending" | "error";
type ConnectionType = "iam_role" | "access_key" | "sso";

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  connectionType: ConnectionType;
  status: AwsAccountStatus;
  description?: string;
  region?: string;
  lastVerifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}

function getStatusColor(status: AwsAccountStatus): string {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "yellow";
    case "error":
      return "red";
    case "inactive":
      return "gray";
    default:
      return "gray";
  }
}

function getStatusIcon(status: AwsAccountStatus) {
  switch (status) {
    case "active":
      return <IconCheck size={14} />;
    case "pending":
      return <IconClock size={14} />;
    case "error":
      return <IconAlertCircle size={14} />;
    default:
      return null;
  }
}

function formatConnectionType(type: ConnectionType): string {
  switch (type) {
    case "iam_role":
      return "IAM Role";
    case "access_key":
      return "Access Key";
    case "sso":
      return "SSO";
    default:
      return type;
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function AccountsPage() {
  const { data: session } = useSession();
  const [connectModalOpened, { open: openConnectModal, close: closeConnectModal }] = useDisclosure(false);
  const [disconnectModalOpened, { open: openDisconnectModal, close: closeDisconnectModal }] = useDisclosure(false);
  const [selectedAccount, setSelectedAccount] = useState<AwsAccount | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("iam_role");
  const [isLoading, setIsLoading] = useState(false);

  // Form state for IAM Role
  const [iamFormData, setIamFormData] = useState({
    name: "",
    accountNumber: "",
    roleArn: "",
    externalId: "",
    description: "",
    region: "",
  });

  // Form state for Access Key
  const [keyFormData, setKeyFormData] = useState({
    name: "",
    accountNumber: "",
    accessKeyId: "",
    secretAccessKey: "",
    description: "",
    region: "",
  });

  // Generate a unique external ID for new connections
  const generatedExternalId = useMemo(() => {
    return `costopt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Convex queries and mutations
  const accounts = useQuery(api.awsAccounts.listByOrganization) as AwsAccount[] | undefined;
  const cfTemplate = useQuery(api.awsAccounts.generateCloudFormationTemplate, {
    externalId: iamFormData.externalId || generatedExternalId,
  }) as { template: string } | undefined;

  const connectWithRole = useMutation(api.awsAccounts.connectWithRole);
  const connectWithKeys = useMutation(api.awsAccounts.connectWithKeys);
  const disconnect = useMutation(api.awsAccounts.disconnect);

  // Set default external ID when modal opens
  const handleOpenConnectModal = () => {
    setIamFormData((prev) => ({
      ...prev,
      externalId: generatedExternalId,
    }));
    openConnectModal();
  };

  const handleDisconnectClick = (account: AwsAccount) => {
    setSelectedAccount(account);
    openDisconnectModal();
  };

  const handleConfirmDisconnect = async () => {
    if (!selectedAccount) return;

    setIsLoading(true);
    try {
      await disconnect({
        awsAccountId: selectedAccount._id,
        userId: session?.user?.id,
      });
      closeDisconnectModal();
      setSelectedAccount(null);
      showSuccessToast("Account disconnected successfully");
    } catch {
      showErrorToast("Failed to disconnect account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWithRole = async () => {
    setIsLoading(true);
    try {
      await connectWithRole({
        organizationId: "org-placeholder", // In production, get from context
        userId: session?.user?.id,
        name: iamFormData.name,
        accountNumber: iamFormData.accountNumber,
        roleArn: iamFormData.roleArn,
        externalId: iamFormData.externalId,
        description: iamFormData.description || undefined,
        region: iamFormData.region || undefined,
      });
      closeConnectModal();
      resetForms();
      showSuccessToast("AWS account connected successfully");
    } catch {
      showErrorToast("Failed to connect account. Please verify your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWithKeys = async () => {
    setIsLoading(true);
    try {
      await connectWithKeys({
        organizationId: "org-placeholder", // In production, get from context
        userId: session?.user?.id,
        name: keyFormData.name,
        accountNumber: keyFormData.accountNumber,
        accessKeyId: keyFormData.accessKeyId,
        secretAccessKey: keyFormData.secretAccessKey,
        description: keyFormData.description || undefined,
        region: keyFormData.region || undefined,
      });
      closeConnectModal();
      resetForms();
      showSuccessToast("AWS account connected successfully");
    } catch {
      showErrorToast("Failed to connect account. Please verify your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForms = () => {
    setIamFormData({
      name: "",
      accountNumber: "",
      roleArn: "",
      externalId: "",
      description: "",
      region: "",
    });
    setKeyFormData({
      name: "",
      accountNumber: "",
      accessKeyId: "",
      secretAccessKey: "",
      description: "",
      region: "",
    });
  };

  const handleDownloadTemplate = () => {
    if (!cfTemplate?.template) return;

    const blob = new Blob([cfTemplate.template], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aws-cost-optimizer-role.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const accountList = accounts || [];

  return (
    <Container data-testid="accounts-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>AWS Accounts</Title>
            <Text c="dimmed" size="sm">
              Manage your connected AWS accounts for cost analysis
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenConnectModal}
          >
            Connect Account
          </Button>
        </Group>

        {/* Accounts List */}
        <Paper data-testid="accounts-list" withBorder p="md">
          {accountList.length === 0 ? (
            <Stack align="center" py="xl" gap="md">
              <IconCloud size={48} style={{ opacity: 0.5 }} />
              <Text c="dimmed" ta="center">
                No AWS accounts connected yet.
                <br />
                Click "Connect Account" to get started.
              </Text>
            </Stack>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Account Number</Table.Th>
                  <Table.Th>Connection Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Synced</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accountList.map((account) => (
                  <Table.Tr key={account._id}>
                    <Table.Td>
                      <Text fw={500}>{account.name}</Text>
                      {account.description && (
                        <Text size="xs" c="dimmed">
                          {account.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Code>{account.accountNumber}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        leftSection={
                          account.connectionType === "iam_role" ? (
                            <IconCloud size={12} />
                          ) : (
                            <IconKey size={12} />
                          )
                        }
                      >
                        {formatConnectionType(account.connectionType)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        data-testid={`status-badge-${account.status}`}
                        color={getStatusColor(account.status)}
                        variant="filled"
                        leftSection={getStatusIcon(account.status)}
                      >
                        {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {account.lastVerifiedAt ? (
                        <Text size="sm">Last synced {formatRelativeTime(account.lastVerifiedAt)}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          Never synced
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="Verify connection">
                          <ActionIcon variant="light" color="blue">
                            <IconRefresh size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Disconnect account">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => handleDisconnectClick(account)}
                            aria-label="Disconnect"
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
          )}
        </Paper>
      </Stack>

      {/* Connect Account Modal */}
      <Modal
        data-testid="connect-modal"
        opened={connectModalOpened}
        onClose={closeConnectModal}
        title="Connect AWS Account"
        size="lg"
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="iam_role" leftSection={<IconCloud size={14} />}>
              IAM Role
            </Tabs.Tab>
            <Tabs.Tab value="access_key" leftSection={<IconKey size={14} />}>
              Access Key
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="iam_role" pt="md">
            <Stack gap="md">
              <Alert color="blue" icon={<IconCloud size={16} />}>
                <Text size="sm">
                  IAM Role is the recommended and most secure connection method. Deploy our
                  CloudFormation template to create the required IAM role in your AWS account.
                </Text>
              </Alert>

              <Divider label="Step 1: Deploy CloudFormation Template" labelPosition="left" />

              <Stack gap="xs">
                <Text size="sm">
                  Download and deploy this CloudFormation template in your AWS account to create the
                  required IAM role:
                </Text>
                <Group>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    onClick={handleDownloadTemplate}
                  >
                    Download CloudFormation Template
                  </Button>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Your External ID:
                  </Text>
                  <Code>{iamFormData.externalId || generatedExternalId}</Code>
                  <CopyButton value={iamFormData.externalId || generatedExternalId}>
                    {({ copied, copy }) => (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={copy}
                        color={copied ? "green" : "gray"}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
              </Stack>

              <Divider label="Step 2: Enter Connection Details" labelPosition="left" />

              <TextInput
                label="Account Name"
                placeholder="e.g., Production, Development"
                required
                value={iamFormData.name}
                onChange={(e) => setIamFormData({ ...iamFormData, name: e.target.value })}
              />

              <TextInput
                label="Account Number"
                placeholder="123456789012"
                required
                maxLength={12}
                value={iamFormData.accountNumber}
                onChange={(e) =>
                  setIamFormData({ ...iamFormData, accountNumber: e.target.value.replace(/\D/g, "") })
                }
              />

              <TextInput
                label="Role ARN"
                placeholder="arn:aws:iam::123456789012:role/AWSCostOptimizerRole"
                required
                value={iamFormData.roleArn}
                onChange={(e) => setIamFormData({ ...iamFormData, roleArn: e.target.value })}
              />

              <TextInput
                label="External ID"
                placeholder="Auto-generated"
                required
                value={iamFormData.externalId}
                onChange={(e) => setIamFormData({ ...iamFormData, externalId: e.target.value })}
              />

              <TextInput
                label="Region (optional)"
                placeholder="us-east-1"
                value={iamFormData.region}
                onChange={(e) => setIamFormData({ ...iamFormData, region: e.target.value })}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeConnectModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWithRole}
                  loading={isLoading}
                  disabled={
                    !iamFormData.name ||
                    !iamFormData.accountNumber ||
                    !iamFormData.roleArn ||
                    !iamFormData.externalId
                  }
                >
                  Connect
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="access_key" pt="md">
            <Stack gap="md">
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  Access keys are less secure than IAM roles. We recommend using IAM role-based
                  access. If you must use access keys, ensure you rotate them regularly and use
                  least-privilege permissions.
                </Text>
              </Alert>

              <TextInput
                label="Account Name"
                placeholder="e.g., Production, Development"
                required
                value={keyFormData.name}
                onChange={(e) => setKeyFormData({ ...keyFormData, name: e.target.value })}
              />

              <TextInput
                label="Account Number"
                placeholder="123456789012"
                required
                maxLength={12}
                value={keyFormData.accountNumber}
                onChange={(e) =>
                  setKeyFormData({ ...keyFormData, accountNumber: e.target.value.replace(/\D/g, "") })
                }
              />

              <TextInput
                label="Access Key ID"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                required
                value={keyFormData.accessKeyId}
                onChange={(e) => setKeyFormData({ ...keyFormData, accessKeyId: e.target.value })}
              />

              <TextInput
                label="Secret Access Key"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                required
                type="password"
                value={keyFormData.secretAccessKey}
                onChange={(e) =>
                  setKeyFormData({ ...keyFormData, secretAccessKey: e.target.value })
                }
              />

              <TextInput
                label="Region (optional)"
                placeholder="us-east-1"
                value={keyFormData.region}
                onChange={(e) => setKeyFormData({ ...keyFormData, region: e.target.value })}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeConnectModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWithKeys}
                  loading={isLoading}
                  disabled={
                    !keyFormData.name ||
                    !keyFormData.accountNumber ||
                    !keyFormData.accessKeyId ||
                    !keyFormData.secretAccessKey
                  }
                >
                  Connect
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Disconnect Confirmation Modal */}
      <Modal
        data-testid="confirm-disconnect-modal"
        opened={disconnectModalOpened}
        onClose={closeDisconnectModal}
        title="Disconnect AWS Account"
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to disconnect{" "}
            <Text span fw={600}>
              {selectedAccount?.name}
            </Text>
            ?
          </Text>
          <Text size="sm" c="dimmed">
            This will remove all credentials and stop cost analysis for this account. This action
            cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDisconnectModal}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmDisconnect} loading={isLoading}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default AccountsPage;
