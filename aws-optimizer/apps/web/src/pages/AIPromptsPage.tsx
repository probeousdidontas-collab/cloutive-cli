import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Container,
  Title,
  Group,
  Grid,
  Text,
  Loader,
  Center,
  Paper,
} from "@mantine/core";
import { useQuery } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

export const AIPromptsPage = observer(function AIPromptsPage() {
  const promptsData = useQuery(api.reportPrompts.list);
  const [selectedId, setSelectedId] = useState<Id<"reportPrompts"> | null>(null);

  if (!promptsData) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  const allPrompts = [...promptsData.systemDefaults, ...promptsData.orgOverrides];
  const selectedPrompt = selectedId ? allPrompts.find((p) => p._id === selectedId) : null;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>AI Prompts</Title>
      </Group>

      <Grid>
        <Grid.Col span={3}>
          <Paper withBorder p="sm">
            <Text c="dimmed" size="sm">
              {promptsData.systemDefaults.length} system defaults,{" "}
              {promptsData.orgOverrides.length} overrides
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={9}>
          {selectedPrompt ? (
            <Text>Selected: {selectedPrompt.label}</Text>
          ) : (
            <Center h={300}>
              <Text c="dimmed">Select a prompt to edit</Text>
            </Center>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
});
