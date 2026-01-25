import { useState, useCallback } from "react";
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
import { useQuery, useMutation } from "convex/react";
import { useSession } from "../lib/auth-client";

// API placeholder - in production, import from Convex generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = {
  orgMembers: {
    list: "api.orgMembers.list",
    invite: "api.orgMembers.invite",
    updateRole: "api.orgMembers.updateRole",
    remove: "api.orgMembers.remove",
  },
};

type MemberRole = "owner" | "admin" | "member" | "viewer";

interface Member {
  _id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  createdAt: number;
  updatedAt: number;
  user: {
    _id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
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
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Modal states
  const [inviteModalOpened, { open: openInviteModal, close: closeInviteModal }] = useDisclosure(false);
  const [removeModalOpened, { open: openRemoveModal, close: closeRemoveModal }] = useDisclosure(false);
  const [roleMenuOpened, setRoleMenuOpened] = useState<string | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Fetch data
  const members = useQuery(api.orgMembers.list) as Member[] | undefined;

  // Mutations
  const inviteMember = useMutation(api.orgMembers.invite);
  const updateRole = useMutation(api.orgMembers.updateRole);
  const removeMember = useMutation(api.orgMembers.remove);

  // Reset invite form
  const resetInviteForm = useCallback(() => {
    setInviteEmail("");
    setInviteRole("member");
  }, []);

  // Handle invite
  const handleInvite = useCallback(async () => {
    await inviteMember({
      inviteeEmail: inviteEmail,
      role: inviteRole,
    });
    closeInviteModal();
    resetInviteForm();
  }, [inviteEmail, inviteRole, inviteMember, closeInviteModal, resetInviteForm]);

  // Handle role change
  const handleRoleChange = useCallback(
    async (memberId: string, newRole: MemberRole) => {
      await updateRole({
        memberId,
        newRole,
      });
      setRoleMenuOpened(null);
    },
    [updateRole]
  );

  // Handle remove click
  const handleRemoveClick = useCallback(
    (member: Member) => {
      setSelectedMember(member);
      openRemoveModal();
    },
    [openRemoveModal]
  );

  // Handle confirm remove
  const handleConfirmRemove = useCallback(async () => {
    if (!selectedMember) return;
    await removeMember({
      memberId: selectedMember._id,
    });
    closeRemoveModal();
    setSelectedMember(null);
  }, [selectedMember, removeMember, closeRemoveModal]);

  const isLoading = members === undefined;
  const memberCount = members?.length || 0;

  // Check if current user can manage (is owner or admin)
  const currentMember = members?.find((m) => m.userId === currentUserId);
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
            ) : members && members.length === 0 ? (
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
                  {members?.map((member) => {
                    const isCurrentUser = member.userId === currentUserId;
                    const isOwner = member.role === "owner";
                    const canModify = canManage && !isCurrentUser && !isOwner;

                    return (
                      <Table.Tr
                        key={member._id}
                        data-testid={`member-item-${member._id}`}
                      >
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar
                              src={member.user?.image}
                              alt={member.user?.name || ""}
                              radius="xl"
                              size="sm"
                            >
                              {member.user?.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Text fw={500}>
                              {member.user?.name}
                              {isCurrentUser && (
                                <Text span c="dimmed" size="xs" ml={4}>
                                  (you)
                                </Text>
                              )}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{member.user?.email}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            data-testid={`role-badge-${member._id}`}
                            color={getRoleColor(member.role)}
                            variant="light"
                            leftSection={getRoleIcon(member.role)}
                          >
                            {capitalizeFirst(member.role)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            data-testid={`status-badge-${member._id}`}
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
                                  opened={roleMenuOpened === member._id}
                                  onClose={() => setRoleMenuOpened(null)}
                                  position="bottom-end"
                                >
                                  <Menu.Target>
                                    <Button
                                      variant="subtle"
                                      size="xs"
                                      rightSection={<IconChevronDown size={14} />}
                                      onClick={() => setRoleMenuOpened(member._id)}
                                      aria-label="Change Role"
                                    >
                                      Change Role
                                    </Button>
                                  </Menu.Target>
                                  <Menu.Dropdown data-testid="role-menu">
                                    <Menu.Item
                                      leftSection={<IconShield size={14} />}
                                      onClick={() => handleRoleChange(member._id, "admin")}
                                    >
                                      Admin
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconUser size={14} />}
                                      onClick={() => handleRoleChange(member._id, "member")}
                                    >
                                      Member
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconEye size={14} />}
                                      onClick={() => handleRoleChange(member._id, "viewer")}
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
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail}>
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
              {selectedMember?.user?.name}
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
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmRemove}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default TeamPage;
