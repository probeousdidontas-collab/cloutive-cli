import { useState, useCallback, useEffect, useMemo } from "react";
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
  Badge,
  Table,
  Menu,
  ActionIcon,
  Tooltip,
  Skeleton,
  Avatar,
  Divider,
  Radio,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconUsers,
  IconTrash,
  IconChevronDown,
  IconShield,
  IconUser,
  IconEye,
  IconCrown,
  IconCheck,
} from "@tabler/icons-react";
import { useSession, organizationMethods } from "../lib/auth-client";
import { showSuccessToast, showErrorToast } from "../lib/notifications";
import { useActiveOrganization } from "../hooks";

type MemberRole = "owner" | "admin" | "member" | "viewer";

// Better Auth organization member structure
interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  createdAt?: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  // Flattened fields from getFullOrganization response
  name?: string;
  email?: string;
}

function getRoleColor(role: MemberRole): string {
  const colors: Record<MemberRole, string> = {
    owner: "violet",
    admin: "blue",
    member: "green",
    viewer: "gray",
  };
  return colors[role] || "gray";
}

function getRoleIcon(role: MemberRole) {
  const icons: Record<MemberRole, React.ReactNode> = {
    owner: <IconCrown size={14} />,
    admin: <IconShield size={14} />,
    member: <IconUser size={14} />,
    viewer: <IconEye size={14} />,
  };
  return icons[role] || <IconUser size={14} />;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function TeamPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const currentUserId = session?.user?.id;
  const isAuthenticated = !isSessionPending && session !== null;

  // Fetch organization using custom hook (includes members)
  const { 
    organization, 
    isLoading, 
    error: orgError, 
    refetch: refetchOrganization 
  } = useActiveOrganization(isAuthenticated);

  // Modal states
  const [inviteModalOpened, { open: openInviteModal, close: closeInviteModal }] = useDisclosure(false);
  const [removeModalOpened, { open: openRemoveModal, close: closeRemoveModal }] = useDisclosure(false);
  const [roleMenuOpened, setRoleMenuOpened] = useState<string | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Submitting state (separate from loading)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map organization members to our Member interface
  const members: Member[] = useMemo(() => {
    if (!organization?.members) return [];
    return organization.members.map((m) => ({
      id: m.id,
      userId: m.userId || m.id,
      role: (m.role || "member") as MemberRole,
      name: m.name,
      email: m.email,
      user: m.user || (m.name && m.email ? { id: m.id, name: m.name, email: m.email } : undefined),
    }));
  }, [organization?.members]);

  // Show error toast if organization fetch fails
  useEffect(() => {
    if (orgError) {
      showErrorToast("Failed to load team members");
    }
  }, [orgError]);

  // Reset invite form
  const resetInviteForm = useCallback(() => {
    setInviteEmail("");
    setInviteRole("member");
  }, []);

  // Handle invite using Better Auth organizationMethods
  const handleInvite = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await organizationMethods.inviteMember(inviteEmail, inviteRole);
      if (result.error) {
        showErrorToast(`Failed to send invitation: ${result.error.message || "Unknown error"}`);
      } else {
        showSuccessToast(`Invitation sent to ${inviteEmail}`);
        closeInviteModal();
        resetInviteForm();
        // Refresh organization (and members)
        await refetchOrganization();
      }
    } catch {
      showErrorToast("Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteEmail, inviteRole, closeInviteModal, resetInviteForm, refetchOrganization]);

  // Handle role change using Better Auth organizationMethods
  const handleRoleChange = useCallback(
    async (memberId: string, newRole: MemberRole) => {
      setIsSubmitting(true);
      try {
        const result = await organizationMethods.updateMemberRole(memberId, newRole);
        if (result.error) {
          showErrorToast(`Failed to update role: ${result.error.message || "Unknown error"}`);
        } else {
          showSuccessToast("Role updated successfully");
          // Refresh organization (and members)
          await refetchOrganization();
        }
      } catch {
        showErrorToast("Failed to update role");
      } finally {
        setRoleMenuOpened(null);
        setIsSubmitting(false);
      }
    },
    [refetchOrganization]
  );

  // Handle remove click
  const handleRemoveClick = useCallback(
    (member: Member) => {
      setSelectedMember(member);
      openRemoveModal();
    },
    [openRemoveModal]
  );

  // Handle confirm remove using Better Auth organizationMethods
  const handleConfirmRemove = useCallback(async () => {
    if (!selectedMember) return;
    setIsSubmitting(true);
    try {
      const result = await organizationMethods.removeMember(selectedMember.id);
      if (result.error) {
        showErrorToast(`Failed to remove member: ${result.error.message || "Unknown error"}`);
      } else {
        showSuccessToast("Member removed successfully");
        closeRemoveModal();
        setSelectedMember(null);
        // Refresh organization (and members)
        await refetchOrganization();
      }
    } catch {
      showErrorToast("Failed to remove member");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedMember, closeRemoveModal, refetchOrganization]);

  const memberCount = members.length;

  // Check if current user can manage (is owner or admin)
  const currentMember = members.find((m) => m.userId === currentUserId || m.id === currentUserId);
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

  return (
    <Container data-testid="team-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Team</Title>
            <Text c="dimmed" size="sm">
              Manage your team members and their permissions
            </Text>
          </Stack>
          <Group gap="md">
            <Badge
              data-testid="member-count"
              variant="light"
              color="blue"
              size="lg"
              leftSection={<IconUsers size={14} />}
            >
              {memberCount}
            </Badge>
            {canManage && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openInviteModal}
              >
                Invite Member
              </Button>
            )}
          </Group>
        </Group>

        {/* Members List */}
        <Paper data-testid="members-list" withBorder p="md">
          <Stack gap="md">
            <Group gap="xs">
              <IconUsers size={18} />
              <Title order={4}>Team Members</Title>
            </Group>

            {isLoading ? (
              <Stack gap="sm">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height={60} />
                ))}
              </Stack>
            ) : members.length === 0 ? (
              <Stack align="center" py="xl">
                <IconUsers size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  No team members yet.
                  <br />
                  Invite your first team member to get started.
                </Text>
              </Stack>
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {members.map((member) => {
                    const memberName = member.user?.name || member.name || "Unknown";
                    const memberEmail = member.user?.email || member.email || "";
                    const memberImage = member.user?.image;
                    const isCurrentUser = member.userId === currentUserId || member.id === currentUserId;
                    const isOwner = member.role === "owner";
                    const canModify = canManage && !isCurrentUser && !isOwner;

                    return (
                      <Table.Tr
                        key={member.id}
                        data-testid={`member-item-${member.id}`}
                      >
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar
                              src={memberImage}
                              alt={memberName}
                              radius="xl"
                              size="sm"
                            >
                              {memberName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Text fw={500}>
                              {memberName}
                              {isCurrentUser && (
                                <Text span c="dimmed" size="xs" ml={4}>
                                  (you)
                                </Text>
                              )}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{memberEmail}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            data-testid={`role-badge-${member.id}`}
                            color={getRoleColor(member.role)}
                            variant="light"
                            leftSection={getRoleIcon(member.role)}
                          >
                            {capitalizeFirst(member.role)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            data-testid={`status-badge-${member.id}`}
                            color="green"
                            variant="outline"
                            leftSection={<IconCheck size={12} />}
                          >
                            Active
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {canModify && (
                              <>
                                <Menu
                                  opened={roleMenuOpened === member.id}
                                  onClose={() => setRoleMenuOpened(null)}
                                  position="bottom-end"
                                >
                                  <Menu.Target>
                                    <Button
                                      variant="subtle"
                                      size="xs"
                                      rightSection={<IconChevronDown size={14} />}
                                      onClick={() => setRoleMenuOpened(member.id)}
                                      aria-label="Change Role"
                                      disabled={isSubmitting}
                                    >
                                      Change Role
                                    </Button>
                                  </Menu.Target>
                                  <Menu.Dropdown data-testid="role-menu">
                                    <Menu.Item
                                      leftSection={<IconShield size={14} />}
                                      onClick={() => handleRoleChange(member.id, "admin")}
                                    >
                                      Admin
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconUser size={14} />}
                                      onClick={() => handleRoleChange(member.id, "member")}
                                    >
                                      Member
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconEye size={14} />}
                                      onClick={() => handleRoleChange(member.id, "viewer")}
                                    >
                                      Viewer
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>

                                <Tooltip label="Remove member">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleRemoveClick(member)}
                                    aria-label="Remove"
                                    disabled={isSubmitting}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>
      </Stack>

      {/* Invite Member Modal */}
      <Modal
        opened={inviteModalOpened}
        onClose={() => {
          closeInviteModal();
          resetInviteForm();
        }}
        title="Invite Team Member"
        size="md"
        data-testid="invite-modal"
      >
        <Stack gap="md">
          <TextInput
            label="Email Address"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <div data-testid="role-selector">
            <Text size="sm" fw={500} mb={4}>
              Role
            </Text>
            <Radio.Group
              value={inviteRole}
              onChange={(value) => setInviteRole(value as MemberRole)}
            >
              <Stack gap="xs">
                <Radio
                  value="admin"
                  label="Admin"
                  description="Can manage team members and all resources"
                />
                <Radio
                  value="member"
                  label="Member"
                  description="Can view and edit resources"
                />
                <Radio
                  value="viewer"
                  label="Viewer"
                  description="Can only view resources"
                />
              </Stack>
            </Radio.Group>
          </div>

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeInviteModal();
                resetInviteForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || isSubmitting} loading={isSubmitting}>
              Send Invite
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        opened={removeModalOpened}
        onClose={() => {
          closeRemoveModal();
          setSelectedMember(null);
        }}
        title="Remove Team Member"
        size="sm"
        data-testid="confirm-remove-modal"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to remove{" "}
            <Text span fw={600}>
              {selectedMember?.user?.name || selectedMember?.name || "this member"}
            </Text>{" "}
            from the team?
          </Text>
          <Text size="sm" c="dimmed">
            They will lose access to all resources immediately. This action cannot be undone.
          </Text>

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeRemoveModal();
                setSelectedMember(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmRemove} loading={isSubmitting}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default TeamPage;
