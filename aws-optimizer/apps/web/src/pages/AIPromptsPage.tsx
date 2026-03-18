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
  Modal,
  Stack,
  TextInput,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { PromptList } from "../components/prompts/PromptList";
import { PromptEditor } from "../components/prompts/PromptEditor";
import { VersionHistoryDrawer } from "../components/prompts/VersionHistoryDrawer";

export const AIPromptsPage = observer(function AIPromptsPage() {
  const promptsData = useQuery(api.reportPrompts.list, {});
  const [selectedId, setSelectedId] = useState<Id<"reportPrompts"> | null>(null);
  const [historyOpened, historyDrawer] = useDisclosure(false);
  const [newTypeModalOpened, newTypeModal] = useDisclosure(false);
  const [resetModalOpened, resetModal] = useDisclosure(false);
  const [overrideModalOpened, overrideModal] = useDisclosure(false);

  // New type form state
  const [newTypeSlug, setNewTypeSlug] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const createPrompt = useMutation(api.reportPrompts.create);
  const removePrompt = useMutation(api.reportPrompts.remove);

  // TODO: determine from user context — for now platform admin is false
  const isAdmin = false;

  if (!promptsData) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  const allPrompts = [...promptsData.systemDefaults, ...promptsData.orgOverrides];
  const selectedPrompt = selectedId ? allPrompts.find((p) => p._id === selectedId) : null;

  // Determine edit permissions
  const canEdit = selectedPrompt
    ? selectedPrompt.isSystem
      ? isAdmin
      : true // org override — org members can edit
    : false;

  // Check if selected is a system default that has no org override yet
  const hasOrgOverride = selectedPrompt?.isSystem
    ? promptsData.orgOverrides.some((o) => o.type === selectedPrompt.type)
    : false;

  const handleCreateOverride = async () => {
    if (!selectedPrompt) return;
    try {
      const result = await createPrompt({
        type: selectedPrompt.type,
        label: selectedPrompt.label,
        isSystem: false,
        sections: selectedPrompt.sections,
        freeformSuffix: selectedPrompt.freeformSuffix,
        changeMessage: "Created from system default",
      });
      setSelectedId(result.promptId);
      overrideModal.close();
    } catch (e) {
      console.error("Failed to create override:", e);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedPrompt || selectedPrompt.isSystem) return;
    try {
      // Find the system default for this type to switch to
      const systemDefault = promptsData.systemDefaults.find(
        (p) => p.type === selectedPrompt.type
      );
      await removePrompt({ id: selectedPrompt._id });
      setSelectedId(systemDefault?._id ?? null);
      resetModal.close();
    } catch (e) {
      console.error("Failed to reset to default:", e);
    }
  };

  const handleCreateNewType = async () => {
    if (!newTypeSlug || !newTypeLabel) return;
    try {
      const result = await createPrompt({
        type: newTypeSlug,
        label: newTypeLabel,
        isSystem: true,
        sections: [
          {
            key: "instructions",
            label: "Instructions",
            value: "",
            fieldType: "textarea",
          },
        ],
        freeformSuffix: "",
        changeMessage: "Initial version",
      });
      setSelectedId(result.promptId);
      setNewTypeSlug("");
      setNewTypeLabel("");
      newTypeModal.close();
    } catch (e) {
      console.error("Failed to create new type:", e);
    }
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>AI Prompts</Title>
      </Group>

      <Grid>
        <Grid.Col span={3}>
          <Paper withBorder p="sm">
            <PromptList
              systemDefaults={promptsData.systemDefaults}
              orgOverrides={promptsData.orgOverrides}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isAdmin={isAdmin}
              onCreateNew={newTypeModal.open}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={9}>
          {selectedPrompt ? (
            <Stack>
              <PromptEditor
                prompt={selectedPrompt}
                canEdit={canEdit}
                onResetToDefault={
                  !selectedPrompt.isSystem ? resetModal.open : undefined
                }
                onViewHistory={historyDrawer.open}
              />

              {/* Show "Customize for My Organization" button for system defaults without override (only if user has an org) */}
              {selectedPrompt.isSystem && !hasOrgOverride && promptsData.hasOrg && (
                <Button
                  variant="light"
                  onClick={overrideModal.open}
                  fullWidth
                >
                  Customize for My Organization
                </Button>
              )}
            </Stack>
          ) : (
            <Center h={300}>
              <Text c="dimmed">Select a prompt to edit</Text>
            </Center>
          )}
        </Grid.Col>
      </Grid>

      {/* Version History Drawer */}
      {selectedPrompt && (
        <VersionHistoryDrawer
          opened={historyOpened}
          onClose={historyDrawer.close}
          promptId={selectedPrompt._id}
          promptLabel={selectedPrompt.label}
        />
      )}

      {/* Reset to Default Confirmation Modal */}
      <Modal
        opened={resetModalOpened}
        onClose={resetModal.close}
        title="Reset to Default"
      >
        <Stack>
          <Text>
            This will remove your organization&apos;s customization and all
            version history for this prompt. The system default will be used
            instead.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={resetModal.close}>
              Cancel
            </Button>
            <Button color="red" onClick={handleResetToDefault}>
              Reset to Default
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Create Override Confirmation Modal */}
      <Modal
        opened={overrideModalOpened}
        onClose={overrideModal.close}
        title="Customize Prompt"
      >
        <Stack>
          <Text>
            This will create an organization-specific copy of the{" "}
            <strong>{selectedPrompt?.label}</strong> prompt that you can
            customize. The system default will no longer be used for your
            organization.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={overrideModal.close}>
              Cancel
            </Button>
            <Button onClick={handleCreateOverride}>Create Override</Button>
          </Group>
        </Stack>
      </Modal>

      {/* New Report Type Modal (admin only) */}
      <Modal
        opened={newTypeModalOpened}
        onClose={newTypeModal.close}
        title="New Report Type"
      >
        <Stack>
          <TextInput
            label="Type Slug"
            description="Unique identifier (e.g. 'security_audit')"
            placeholder="my_custom_report"
            value={newTypeSlug}
            onChange={(e) => setNewTypeSlug(e.currentTarget.value)}
          />
          <TextInput
            label="Label"
            description="Human-readable name"
            placeholder="My Custom Report"
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={newTypeModal.close}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewType}
              disabled={!newTypeSlug || !newTypeLabel}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
});
