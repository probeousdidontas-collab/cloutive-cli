import { useState } from "react";
import {
  Stack,
  Title,
  Badge,
  Group,
  Button,
  Textarea,
  TextInput,
  Select,
  Accordion,
  Modal,
  Text,
  Alert,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Doc } from "@aws-optimizer/convex/convex/_generated/dataModel";

type Prompt = Doc<"reportPrompts">;
type Section = Prompt["sections"][number];

interface PromptEditorProps {
  prompt: Prompt;
  canEdit: boolean;
  onResetToDefault?: () => void;
  onViewHistory: () => void;
}

export function PromptEditor({
  prompt,
  canEdit,
  onResetToDefault,
  onViewHistory,
}: PromptEditorProps) {
  const [sections, setSections] = useState<Section[]>(prompt.sections);
  const [freeformSuffix, setFreeformSuffix] = useState(prompt.freeformSuffix);
  const [saveModalOpened, saveModal] = useDisclosure(false);
  const [changeMessage, setChangeMessage] = useState("");

  const updatePrompt = useMutation(api.reportPrompts.update);
  const toggleActive = useMutation(api.reportPrompts.toggleActive);

  // Reset local state when prompt changes
  const [lastPromptId, setLastPromptId] = useState(prompt._id);
  if (prompt._id !== lastPromptId) {
    setSections(prompt.sections);
    setFreeformSuffix(prompt.freeformSuffix);
    setLastPromptId(prompt._id);
  }

  const hasChanges =
    JSON.stringify(sections) !== JSON.stringify(prompt.sections) ||
    freeformSuffix !== prompt.freeformSuffix;

  const updateSection = (index: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, value } : s))
    );
  };

  const handleSave = async () => {
    await updatePrompt({
      id: prompt._id,
      sections,
      freeformSuffix,
      changeMessage: changeMessage || undefined,
    });
    setChangeMessage("");
    saveModal.close();
  };

  const statusBadge = prompt.isSystem ? (
    <Badge variant="light" color="gray">System Default</Badge>
  ) : (
    <Badge variant="light" color="blue">Org Override</Badge>
  );

  return (
    <Stack>
      {!prompt.isActive && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
          <Group justify="space-between" align="center">
            <Text size="sm">This prompt is inactive and will not be used for report generation.</Text>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => toggleActive({ id: prompt._id })}>
                Activate
              </Button>
            )}
          </Group>
        </Alert>
      )}

      <Group justify="space-between">
        <Group>
          <Title order={3}>{prompt.label}</Title>
          {statusBadge}
        </Group>
        {prompt.isActive && canEdit && (
          <Button size="xs" variant="subtle" color="orange" onClick={() => toggleActive({ id: prompt._id })}>
            Deactivate
          </Button>
        )}
      </Group>

      <Accordion multiple defaultValue={sections.map((s) => s.key)}>
        {sections.map((section, index) => (
          <Accordion.Item key={section.key} value={section.key}>
            <Accordion.Control>{section.label}</Accordion.Control>
            <Accordion.Panel>
              {section.fieldType === "textarea" && (
                <Textarea
                  value={section.value}
                  onChange={(e) => updateSection(index, e.currentTarget.value)}
                  autosize
                  minRows={4}
                  maxRows={20}
                  disabled={!canEdit}
                />
              )}
              {section.fieldType === "text" && (
                <TextInput
                  value={section.value}
                  onChange={(e) => updateSection(index, e.currentTarget.value)}
                  disabled={!canEdit}
                />
              )}
              {section.fieldType === "select" && (
                <Select
                  value={section.value}
                  onChange={(val) => val && updateSection(index, val)}
                  data={section.options ?? []}
                  disabled={!canEdit}
                />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <Textarea
        label="Additional Instructions"
        description="Extra freeform instructions appended to the prompt"
        value={freeformSuffix}
        onChange={(e) => setFreeformSuffix(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={8}
        disabled={!canEdit}
      />

      <Group justify="flex-end">
        {!prompt.isSystem && onResetToDefault && (
          <Button variant="subtle" color="red" onClick={onResetToDefault} disabled={!canEdit}>
            Reset to Default
          </Button>
        )}
        <Button variant="subtle" onClick={onViewHistory}>
          View History
        </Button>
        <Button onClick={saveModal.open} disabled={!hasChanges || !canEdit}>
          Save
        </Button>
      </Group>

      <Modal opened={saveModalOpened} onClose={saveModal.close} title="Save Changes">
        <Stack>
          <TextInput
            label="Change Message (optional)"
            placeholder="Describe what changed..."
            value={changeMessage}
            onChange={(e) => setChangeMessage(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={saveModal.close}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
