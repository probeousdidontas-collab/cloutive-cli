import {
  AppShell,
  Burger,
  Group,
  Title,
  Text,
  NavLink,
  ScrollArea,
  Avatar,
  Menu,
  UnstyledButton,
  Divider,
  Stack,
  Badge,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useSession, signOut } from "../lib/auth-client";
import {
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { NAV_ITEMS } from "./nav-items";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  
  // Theme toggle
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  
  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === "dark" ? "light" : "dark");
  };
  
  // Fetch unacknowledged alert count for navigation badge
  const unacknowledgedCount = useQuery(api.alerts.getUnacknowledgedCount) as number | undefined;

  const user = session?.user;
  const userName = user?.name || "User";
  const userEmail = user?.email || "";

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Title order={3}>AWS Manager</Title>
          </Group>

          <Group gap="sm">
            {/* Organization Switcher */}
            {!isPending && user && <OrganizationSwitcher />}

            {/* Theme Toggle */}
            <Tooltip label={computedColorScheme === "dark" ? "Light mode" : "Dark mode"}>
              <ActionIcon
                onClick={toggleColorScheme}
                variant="subtle"
                size="lg"
                aria-label="Toggle color scheme"
              >
                {computedColorScheme === "dark" ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>
            </Tooltip>
            
            {!isPending && user && (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap="xs">
                      <Avatar size="sm" radius="xl" color="orange">
                        {userName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Stack gap={0} visibleFrom="sm">
                        <Text size="sm" fw={500}>
                          {userName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {userEmail}
                        </Text>
                      </Stack>
                      <IconChevronDown size={14} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Account</Menu.Label>
                  <Menu.Item
                    leftSection={<IconSettings size={14} />}
                    onClick={() => navigate({ to: "/settings" })}
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={14} />}
                    onClick={handleLogout}
                    aria-label="Logout"
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {NAV_ITEMS.slice(0, 6).map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={item.icon}
                active={location.pathname === item.path}
                onClick={() => {
                  navigate({ to: item.path });
                  toggle();
                }}
                data-active={location.pathname === item.path ? "true" : undefined}
              />
            ))}
          </Stack>

          <Divider my="sm" label="Management" labelPosition="left" />

          <Stack gap={4}>
            {NAV_ITEMS.slice(6, 10).map((item) => (
              <NavLink
                key={item.path}
                label={
                  item.path === "/alerts" && unacknowledgedCount && unacknowledgedCount > 0 ? (
                    <Group gap="xs" justify="space-between" style={{ flex: 1 }}>
                      <span>{item.label}</span>
                      <Badge
                        data-testid="nav-alerts-badge"
                        size="sm"
                        variant="filled"
                        color="red"
                      >
                        {unacknowledgedCount}
                      </Badge>
                    </Group>
                  ) : (
                    item.label
                  )
                }
                leftSection={item.icon}
                active={location.pathname === item.path}
                onClick={() => {
                  navigate({ to: item.path });
                  toggle();
                }}
                data-active={location.pathname === item.path ? "true" : undefined}
              />
            ))}
          </Stack>

          <Divider my="sm" label="Administration" labelPosition="left" />

          <Stack gap={4}>
            {NAV_ITEMS.slice(10).map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={item.icon}
                active={location.pathname === item.path}
                onClick={() => {
                  navigate({ to: item.path });
                  toggle();
                }}
                data-active={location.pathname === item.path ? "true" : undefined}
              />
            ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
