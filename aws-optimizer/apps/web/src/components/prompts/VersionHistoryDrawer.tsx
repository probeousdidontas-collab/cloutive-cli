import { useState } from "react";
import {
  Drawer,
  Stack,
  Card,
  Text,
  Group,
  Badge,
  Button,
  Grid,
  ScrollArea,
  Accordion,
  Code,
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { diffLines } from "diff";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

interface VersionHistoryDrawerProps {
  opened: boolean;
  onClose: () => void;
  promptId: Id<"reportPrompts">;
  promptLabel: string;
}

export function VersionHistoryDrawer({
  opened,
  onClose,
  promptId,
  promptLabel,
}: VersionHistoryDrawerProps) {
  const [loadLimit, setLoadLimit] = useState(20);
  const versions = useQuery(
    api.reportPromptVersions.listByPrompt,
    opened ? { promptId, limit: loadLimit } : "skip"
  );
  const updatePrompt = useMutation(api.reportPrompts.update);

  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [restoreModalOpened, restoreModal] = useDisclosure(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewVersion, setViewVersion] = useState<any | null>(null);

  const leftVersion = versions?.find((v) => v.version === compareLeft);
  const rightVersion = versions?.find((v) => v.version === compareRight);

  const handleRestore = async () => {
    const version = versions?.find((v) => v.version === restoreVersion);
    if (!version) return;

    await updatePrompt({
      id: promptId,
      sections: version.sections,
      freeformSuffix: version.freeformSuffix,
      changeMessage: `Restored from v${restoreVersion}`,
    });
    restoreModal.close();
    setRestoreVersion(null);
  };

  const resetCompare = () => {
    setCompareLeft(null);
    setCompareRight(null);
  };

  const isComparing = compareLeft !== null && compareRight !== null && leftVersion && rightVersion;

  return (
    <Drawer
      opened={opened}
      onClose={() => {
        onClose();
        resetCompare();
        setViewVersion(null);
      }}
      title={`Version History — ${promptLabel}`}
      position="right"
      size={isComparing ? "xl" : "md"}
    >
      {isComparing ? (
        <Stack>
          <Group justify="space-between">
            <Badge>v{compareLeft}</Badge>
            <Button variant="subtle" size="xs" onClick={resetCompare}>
              Back to list
            </Button>
            <Badge>v{compareRight}</Badge>
          </Group>

          <Accordion multiple>
            {rightVersion.sections.map((section) => {
              const oldSection = leftVersion.sections.find((s) => s.key === section.key);
              const oldValue = oldSection?.value ?? "";
              const changes = diffLines(oldValue, section.value);
              const hasChanges = changes.some((c) => c.added || c.removed);

              if (!hasChanges) return null;

              return (
                <Accordion.Item key={section.key} value={section.key}>
                  <Accordion.Control>{section.label}</Accordion.Control>
                  <Accordion.Panel>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="xs" fw={700} c="dimmed" mb="xs">v{compareLeft}</Text>
                        <Code block>
                          {changes.map((part, i) => {
                            if (part.added) return null;
                            return (
                              <span
                                key={i}
                                style={{
                                  background: part.removed
                                    ? "var(--mantine-color-red-light)"
                                    : undefined,
                                  display: "block",
                                }}
                              >
                                {part.value}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" fw={700} c="dimmed" mb="xs">v{compareRight}</Text>
                        <Code block>
                          {changes.map((part, i) => {
                            if (part.removed) return null;
                            return (
                              <span
                                key={i}
                                style={{
                                  background: part.added
                                    ? "var(--mantine-color-green-light)"
                                    : undefined,
                                  display: "block",
                                }}
                              >
                                {part.value}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}

            {leftVersion.freeformSuffix !== rightVersion.freeformSuffix && (() => {
              const freeformChanges = diffLines(leftVersion.freeformSuffix, rightVersion.freeformSuffix);
              return (
                <Accordion.Item value="__freeform">
                  <Accordion.Control>Additional Instructions</Accordion.Control>
                  <Accordion.Panel>
                    <Grid>
                      <Grid.Col span={6}>
                        <Code block>
                          {freeformChanges.map((part, i) => {
                            if (part.added) return null;
                            return (
                              <span key={i} style={{ background: part.removed ? "var(--mantine-color-red-light)" : undefined, display: "block" }}>
                                {part.value || "(empty)"}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Code block>
                          {freeformChanges.map((part, i) => {
                            if (part.removed) return null;
                            return (
                              <span key={i} style={{ background: part.added ? "var(--mantine-color-green-light)" : undefined, display: "block" }}>
                                {part.value || "(empty)"}
                              </span>
                            );
                          })}
                        </Code>
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })()}
          </Accordion>
        </Stack>
      ) : viewVersion ? (
        <Stack>
          <Group justify="space-between">
            <Badge>v{viewVersion.version}</Badge>
            <Button variant="subtle" size="xs" onClick={() => setViewVersion(null)}>
              Back to list
            </Button>
          </Group>
          {viewVersion.changeMessage && <Text size="sm" c="dimmed">{viewVersion.changeMessage}</Text>}
          <Accordion multiple>
            {viewVersion.sections.map((s: { key: string; label: string; value: string }) => (
              <Accordion.Item key={s.key} value={s.key}>
                <Accordion.Control>{s.label}</Accordion.Control>
                <Accordion.Panel><Code block>{s.value}</Code></Accordion.Panel>
              </Accordion.Item>
            ))}
            {viewVersion.freeformSuffix && (
              <Accordion.Item value="__freeform">
                <Accordion.Control>Additional Instructions</Accordion.Control>
                <Accordion.Panel><Code block>{viewVersion.freeformSuffix}</Code></Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
        </Stack>
      ) : (
        <ScrollArea h="calc(100vh - 100px)">
          <Stack gap="xs">
            {!versions && <Text c="dimmed">Loading...</Text>}
            {versions?.map((version) => (
              <Card key={version._id} withBorder padding="sm">
                <Group justify="space-between" mb="xs">
                  <Badge variant="light">v{version.version}</Badge>
                  <Text size="xs" c="dimmed">
                    {new Date(version.createdAt).toLocaleString()}
                  </Text>
                </Group>
                {version.changeMessage && (
                  <Text size="sm" mb="xs">{version.changeMessage}</Text>
                )}
                <Group gap="xs">
                  <Button variant="subtle" size="xs" onClick={() => setViewVersion(version)}>
                    View
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      if (compareLeft === null) setCompareLeft(version.version);
                      else if (compareRight === null) setCompareRight(version.version);
                    }}
                    disabled={compareLeft !== null && compareRight !== null}
                  >
                    {compareLeft === null ? "Compare from" : compareRight === null ? "Compare to" : "Compare"}
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="orange"
                    onClick={() => {
                      setRestoreVersion(version.version);
                      restoreModal.open();
                    }}
                  >
                    Restore
                  </Button>
                </Group>
              </Card>
            ))}
            {versions && versions.length >= loadLimit && (
              <Button
                variant="subtle"
                size="xs"
                fullWidth
                onClick={() => setLoadLimit((prev) => prev + 20)}
              >
                Load more
              </Button>
            )}
          </Stack>
        </ScrollArea>
      )}

      <Modal opened={restoreModalOpened} onClose={restoreModal.close} title="Restore Version">
        <Stack>
          <Text>
            Are you sure you want to restore to <strong>v{restoreVersion}</strong>?
            This will create a new version with the restored content.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={restoreModal.close}>Cancel</Button>
            <Button color="orange" onClick={handleRestore}>Restore</Button>
          </Group>
        </Stack>
      </Modal>
    </Drawer>
  );
}
