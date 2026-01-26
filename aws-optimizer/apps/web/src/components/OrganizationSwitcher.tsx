import { useState } from "react";
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
import { observer } from "mobx-react-lite";
import { IS_TEST_MODE } from "../lib/auth-client";
import { useOrganization } from "../hooks/useOrganization";

/**
 * OrganizationSwitcher - Component for switching between organizations.
 *
 * Uses MobX store for organization state, eliminating page reloads on switch.
 */
export const OrganizationSwitcher = observer(function OrganizationSwitcher() {
  const navigate = useNavigate();
  const {
    activeOrganization,
    organizations,
    isLoading,
    isSwitching,
    switchOrganization,
    createOrganization,
  } = useOrganization();

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === activeOrganization?.id) return;
    await switchOrganization(orgId);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;

    setIsCreating(true);
    try {
      const success = await createOrganization(newOrgName, true);
      if (success) {
        closeCreateModal();
        setNewOrgName("");
      }
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

  // Render create modal - must be rendered in all code paths
  const createModal = (
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
  );

  // Show standalone button if no organizations
  if (organizations.length === 0 && !IS_TEST_MODE) {
    return (
      <>
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={openCreateModal}
        >
          Create Organization
        </Button>
        {createModal}
      </>
    );
  }

  return (
    <>
      <Menu shadow="md" width={280} position="bottom-start">
        <Menu.Target>
          <UnstyledButton disabled={isSwitching}>
            <Group gap="xs">
              <Avatar size="sm" radius="sm" color="orange">
                {activeOrganization?.logo ? (
                  <img src={activeOrganization.logo} alt={activeOrganization.name} />
                ) : (
                  <IconBuilding size={16} />
                )}
              </Avatar>
              <Stack gap={0} visibleFrom="md">
                <Text size="sm" fw={500} lineClamp={1}>
                  {activeOrganization?.name || "Select Organization"}
                </Text>
                {activeOrganization?.role && (
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {activeOrganization.role}
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
                org.id === activeOrganization?.id ? (
                  <IconCheck size={14} color="var(--mantine-color-green-6)" />
                ) : null
              }
              onClick={() => handleSwitchOrg(org.id)}
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

          {activeOrganization && (
            <Menu.Item
              leftSection={<IconSettings size={14} />}
              onClick={() => navigate({ to: "/settings" })}
            >
              Organization Settings
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      {createModal}
    </>
  );
});
