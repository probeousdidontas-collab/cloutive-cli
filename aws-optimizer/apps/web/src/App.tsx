import { Outlet } from "@tanstack/react-router";
import { AppShell, Group, Title, Text, Container } from "@mantine/core";

export function App() {
  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={3}>AWS Cost Optimizer</Title>
          </Group>
          <Text size="sm" c="dimmed">
            AI-First Cost Analysis
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
