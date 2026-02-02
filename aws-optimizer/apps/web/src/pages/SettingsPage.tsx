import { useState, useCallback, useEffect } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  TextInput,
  Select,
  Switch,
  Checkbox,
  Card,
  Badge,
  Tooltip,
  ActionIcon,
  Skeleton,
  Divider,
  Code,
  CopyButton,
  SimpleGrid,
} from "@mantine/core";
import {
  IconSettings,
  IconCloud,
  IconBell,
  IconId,
  IconCopy,
  IconCheck,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { useSession, organizationMethods } from "../lib/auth-client";
import { showSuccessToast, showErrorToast } from "../lib/notifications";
import { useActiveOrganization } from "../hooks";

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];

const EMAIL_FREQUENCY_OPTIONS = [
  { value: "realtime", label: "Real-time" },
  { value: "daily", label: "Daily Digest" },
  { value: "weekly", label: "Weekly Summary" },
  { value: "never", label: "Never" },
];

const ALERT_TYPES = [
  { value: "budget_exceeded", label: "Budget Exceeded", description: "When spending exceeds budget thresholds" },
  { value: "anomaly_detected", label: "Anomaly Detected", description: "When unusual spending patterns are detected" },
  { value: "recommendation_available", label: "New Recommendations", description: "When new cost-saving recommendations are available" },
  { value: "cost_spike", label: "Cost Spike", description: "When there's a sudden increase in costs" },
  { value: "resource_idle", label: "Idle Resources", description: "When resources are detected as idle" },
];

export function SettingsPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !isSessionPending && session !== null;

  // Fetch organization using custom hook
  const { 
    organization, 
    isLoading, 
    error: orgError, 
    refetch: refetchOrganization 
  } = useActiveOrganization(isAuthenticated);

  // Form state
  const [orgName, setOrgName] = useState("");
  const [defaultRegion, setDefaultRegion] = useState<string | null>(null);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [emailFrequency, setEmailFrequency] = useState<string | null>("daily");
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form state when organization loads
  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
      setDefaultRegion(organization.metadata?.defaultRegion || "us-east-1");
      setEnableNotifications(organization.metadata?.enableNotifications ?? true);
      setEmailFrequency(
        organization.metadata?.notificationPreferences?.emailFrequency || "daily"
      );
      setSelectedAlertTypes(
        organization.metadata?.notificationPreferences?.alertTypes || [
          "budget_exceeded",
          "anomaly_detected",
          "recommendation_available",
        ]
      );
    }
  }, [organization]);

  // Show error toast if organization fetch fails
  useEffect(() => {
    if (orgError) {
      showErrorToast("Failed to load organization settings");
    }
  }, [orgError]);

  // Handle alert type toggle
  const handleAlertTypeToggle = useCallback((alertType: string) => {
    setSelectedAlertTypes((prev) =>
      prev.includes(alertType)
        ? prev.filter((t) => t !== alertType)
        : [...prev, alertType]
    );
  }, []);

  // Handle save using Better Auth organizationMethods
  const handleSave = useCallback(async () => {
    if (!organization) return;

    setIsSaving(true);
    try {
      const result = await organizationMethods.update({
        organizationId: organization.id,
        name: orgName,
        metadata: {
          ...organization.metadata,
          defaultRegion: defaultRegion || undefined,
          enableNotifications,
          notificationPreferences: {
            emailFrequency: emailFrequency || "daily",
            alertTypes: selectedAlertTypes,
          },
        },
      });

      if (result.error) {
        showErrorToast(`Failed to save settings: ${result.error.message || "Unknown error"}`);
      } else {
        showSuccessToast("Settings saved successfully");
        // Refresh organization data
        await refetchOrganization();
      }
    } catch {
      showErrorToast("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    organization,
    orgName,
    defaultRegion,
    enableNotifications,
    emailFrequency,
    selectedAlertTypes,
    refetchOrganization,
  ]);

  return (
    <Container data-testid="settings-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Settings</Title>
            <Text c="dimmed" size="sm">
              Configure your organization preferences and notifications
            </Text>
          </Stack>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={isSaving}
          >
            Save Changes
          </Button>
        </Group>

        {/* General Settings / Organization Configuration */}
        <Paper data-testid="org-config-section" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconSettings size={20} />
              <Title order={4}>General Settings</Title>
            </Group>

            {isLoading ? (
              <Stack gap="sm">
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <TextInput
                  data-testid="org-name-input"
                  label="Organization Name"
                  description="The display name for your organization"
                  placeholder="Enter organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />

                <TextInput
                  label="Organization Slug"
                  description="URL-friendly identifier (read-only)"
                  value={organization?.slug || ""}
                  disabled
                />
              </SimpleGrid>
            )}
          </Stack>
        </Paper>

        {/* AWS Region Configuration */}
        <Paper data-testid="aws-region-section" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconCloud size={20} />
              <Title order={4}>AWS Configuration</Title>
            </Group>

            {isLoading ? (
              <Skeleton height={60} />
            ) : (
              <Select
                data-testid="default-region-select"
                label="Default AWS Region"
                description="The default region used for new AWS accounts and analysis"
                placeholder="Select a region"
                data={AWS_REGIONS}
                value={defaultRegion}
                onChange={setDefaultRegion}
                searchable
                clearable={false}
              />
            )}
          </Stack>
        </Paper>

        {/* Notification Preferences */}
        <Paper data-testid="notification-section" withBorder p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconBell size={20} />
                <Title order={4}>Notification Preferences</Title>
              </Group>
              <Switch
                data-testid="notifications-toggle"
                label="Enable Notifications"
                checked={enableNotifications}
                onChange={(e) => setEnableNotifications(e.currentTarget.checked)}
              />
            </Group>

            <Divider />

            {isLoading ? (
              <Stack gap="sm">
                <Skeleton height={40} />
                <Skeleton height={100} />
              </Stack>
            ) : (
              <>
                <Select
                  data-testid="email-frequency-select"
                  label="Email Notification Frequency"
                  description="How often you want to receive email notifications"
                  placeholder="Select frequency"
                  data={EMAIL_FREQUENCY_OPTIONS}
                  value={emailFrequency}
                  onChange={setEmailFrequency}
                  disabled={!enableNotifications}
                />

                <div data-testid="alert-types-section">
                  <Text size="sm" fw={500} mb={4}>
                    Alert Types
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Select which types of alerts you want to receive
                  </Text>

                  <Stack gap="xs">
                    {ALERT_TYPES.map((alertType) => (
                      <Card key={alertType.value} withBorder padding="sm">
                        <Group justify="space-between" align="center">
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {alertType.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {alertType.description}
                            </Text>
                          </Stack>
                          <Checkbox
                            checked={selectedAlertTypes.includes(alertType.value)}
                            onChange={() => handleAlertTypeToggle(alertType.value)}
                            disabled={!enableNotifications}
                          />
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </div>
              </>
            )}
          </Stack>
        </Paper>

        {/* Organization ID for Support */}
        <Paper data-testid="org-id-section" withBorder p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconId size={20} />
              <Title order={4}>Support Reference</Title>
            </Group>

            <Text size="sm" c="dimmed">
              Use this Organization ID when contacting support for faster assistance.
            </Text>

            {isLoading ? (
              <Skeleton height={40} />
            ) : (
              <Group gap="sm">
                <Code
                  data-testid="org-id-value"
                  block
                  style={{ flex: 1, padding: "12px 16px", fontSize: "14px" }}
                >
                  {organization?.id || ""}
                </Code>
                <CopyButton value={organization?.id || ""} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied!" : "Copy Organization ID"} withArrow>
                      <ActionIcon
                        data-testid="copy-org-id-button"
                        variant="light"
                        color={copied ? "teal" : "gray"}
                        onClick={copy}
                        size="lg"
                      >
                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            )}

            <Group gap="xs">
              <Badge variant="light" color="blue">
                Plan: {organization?.metadata?.plan || "Free"}
              </Badge>
              <Badge variant="light" color="gray">
                Created: {organization?.createdAt ? new Date(organization.createdAt).toLocaleDateString() : ""}
              </Badge>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default SettingsPage;
