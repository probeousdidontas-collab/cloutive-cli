import { useState, useEffect } from "react";
import {
  Menu,
  UnstyledButton,
  Group,
  Text,
  Avatar,
  Stack,
  Badge,
  Divider,
  Modal,
  TextInput,
  Button,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBuilding,
  IconChevronDown,
  IconPlus,
  IconCheck,
  IconSettings,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { organizationMethods, IS_TEST_MODE } from "../lib/auth-client";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  role?: string;
}

export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const result = await organizationMethods.list();
      if (result.data) {
        setOrganizations(result.data as Organization[]);
        // Get active org from session
        // Better Auth stores active org differently - try to get it from the full organization call
        try {
          const activeOrgResult = await organizationMethods.getActive();
          if (activeOrgResult.data?.id) {
            const active = (result.data as Organization[]).find((org) => org.id === activeOrgResult.data?.id);
            setActiveOrg(active || null);
          } else if (result.data.length > 0) {
            // Default to first org if none active
            setActiveOrg(result.data[0] as Organization);
          }
        } catch {
          // If getActive fails, default to first org
          if (result.data.length > 0) {
            setActiveOrg(result.data[0] as Organization);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchOrg = async (org: Organization) => {
    if (org.id === activeOrg?.id) return;
    
    setIsSwitching(true);
    try {
      const result = await organizationMethods.setActive(org.id);
      if (result.error) {
        showErrorToast(`Failed to switch organization: ${result.error.message}`);
      } else {
        setActiveOrg(org);
        showSuccessToast(`Switched to ${org.name}`);
        // Refresh the page to load new org data
        window.location.reload();
      }
    } catch (error) {
      showErrorToast("Failed to switch organization");
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    
    setIsCreating(true);
    try {
      const slug = newOrgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const result = await organizationMethods.create(newOrgName, slug);
      if (result.error) {
        showErrorToast(`Failed to create organization: ${result.error.message}`);
      } else {
        showSuccessToast(`Organization "${newOrgName}" created`);
        closeCreateModal();
        setNewOrgName("");
        // Refresh orgs and switch to the new one
        await fetchOrganizations();
        if (result.data?.id) {
          await handleSwitchOrg({ id: result.data.id, name: newOrgName, slug });
        }
      }
    } catch (error) {
      showErrorToast("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
      </Group>
    );
  }

  // Don't render if no organizations
  if (organizations.length === 0 && !IS_TEST_MODE) {
    return (
      <Button
        variant="subtle"
        size="sm"
        leftSection={<IconPlus size={16} />}
        onClick={openCreateModal}
      >
        Create Organization
      </Button>
    );
  }

  return (
    <>
      <Menu shadow="md" width={280} position="bottom-start">
        <Menu.Target>
          <UnstyledButton disabled={isSwitching}>
            <Group gap="xs">
              <Avatar size="sm" radius="sm" color="orange">
                {activeOrg?.logo ? (
                  <img src={activeOrg.logo} alt={activeOrg.name} />
                ) : (
                  <IconBuilding size={16} />
                )}
              </Avatar>
              <Stack gap={0} visibleFrom="md">
                <Text size="sm" fw={500} lineClamp={1}>
                  {activeOrg?.name || "Select Organization"}
                </Text>
                {activeOrg?.role && (
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {activeOrg.role}
                  </Text>
                )}
              </Stack>
              {isSwitching ? (
                <Loader size="xs" />
              ) : (
                <IconChevronDown size={14} />
              )}
            </Group>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Organizations</Menu.Label>
          {organizations.map((org) => (
            <Menu.Item
              key={org.id}
              leftSection={
                <Avatar size="sm" radius="sm" color="gray">
                  {org.logo ? (
                    <img src={org.logo} alt={org.name} />
                  ) : (
                    <IconBuilding size={14} />
                  )}
                </Avatar>
              }
              rightSection={
                org.id === activeOrg?.id ? (
                  <IconCheck size={14} color="var(--mantine-color-green-6)" />
                ) : null
              }
              onClick={() => handleSwitchOrg(org)}
            >
              <Group gap="xs" justify="space-between" style={{ flex: 1 }}>
                <Text size="sm" lineClamp={1}>
                  {org.name}
                </Text>
                {org.role && (
                  <Badge size="xs" variant="light" tt="capitalize">
                    {org.role}
                  </Badge>
                )}
              </Group>
            </Menu.Item>
          ))}

          <Divider my="xs" />

          <Menu.Item
            leftSection={<IconPlus size={14} />}
            onClick={openCreateModal}
          >
            Create Organization
          </Menu.Item>

          {activeOrg && (
            <Menu.Item
              leftSection={<IconSettings size={14} />}
              onClick={() => navigate({ to: "/settings" })}
            >
              Organization Settings
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      {/* Create Organization Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create New Organization"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Organization Name"
            placeholder="My Company"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            required
          />
          <Text size="xs" c="dimmed">
            You'll be the owner of this organization and can invite team members.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrg}
              loading={isCreating}
              disabled={!newOrgName.trim()}
            >
              Create Organization
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
