import {
  Stack,
  Text,
  NavLink,
  Badge,
  Divider,
  Button,
  Group,
} from "@mantine/core";
import {
  IconFileText,
  IconCoin,
  IconBulb,
  IconServer,
  IconReportAnalytics,
  IconBrain,
  IconPlus,
} from "@tabler/icons-react";
import type { Doc, Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

type Prompt = Doc<"reportPrompts">;

const KNOWN_SYSTEM_TYPES = new Set([
  "cost_analysis",
  "savings_summary",
  "resource_inventory",
  "recommendation_summary",
  "executive_summary",
  "cost_analysis_insights",
]);

const TYPE_ICONS: Record<string, React.ReactNode> = {
  cost_analysis: <IconCoin size={18} />,
  savings_summary: <IconBulb size={18} />,
  resource_inventory: <IconServer size={18} />,
  recommendation_summary: <IconReportAnalytics size={18} />,
  executive_summary: <IconFileText size={18} />,
  cost_analysis_insights: <IconBrain size={18} />,
};

interface PromptListProps {
  systemDefaults: Prompt[];
  orgOverrides: Prompt[];
  selectedId: Id<"reportPrompts"> | null;
  onSelect: (id: Id<"reportPrompts">) => void;
  isAdmin: boolean;
  onCreateNew?: () => void;
}

export function PromptList({
  systemDefaults,
  orgOverrides,
  selectedId,
  onSelect,
  isAdmin,
  onCreateNew,
}: PromptListProps) {
  const overrideTypes = new Set(orgOverrides.map((o) => o.type));

  // Split system defaults into built-in and custom types
  const builtInDefaults = systemDefaults.filter((p) => KNOWN_SYSTEM_TYPES.has(p.type));
  const customTypes = systemDefaults.filter((p) => !KNOWN_SYSTEM_TYPES.has(p.type));

  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        System Defaults
      </Text>

      {builtInDefaults.map((prompt) => (
        <NavLink
          key={prompt._id}
          label={
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" truncate>{prompt.label}</Text>
              {overrideTypes.has(prompt.type) && (
                <Badge size="xs" variant="light" color="blue">
                  Customized
                </Badge>
              )}
              {!prompt.isActive && (
                <Badge size="xs" variant="light" color="gray">
                  Inactive
                </Badge>
              )}
            </Group>
          }
          leftSection={TYPE_ICONS[prompt.type] ?? <IconFileText size={18} />}
          active={selectedId === prompt._id}
          onClick={() => onSelect(prompt._id)}
          variant="light"
        />
      ))}

      {customTypes.length > 0 && (
        <>
          <Divider my="xs" />
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Custom Types
          </Text>
          {customTypes.map((prompt) => (
            <NavLink
              key={prompt._id}
              label={
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" truncate>{prompt.label}</Text>
                  {!prompt.isActive && (
                    <Badge size="xs" variant="light" color="gray">
                      Inactive
                    </Badge>
                  )}
                </Group>
              }
              leftSection={<IconFileText size={18} />}
              active={selectedId === prompt._id}
              onClick={() => onSelect(prompt._id)}
              variant="light"
            />
          ))}
        </>
      )}

      {orgOverrides.length > 0 && (
        <>
          <Divider my="xs" />
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Organization Overrides
          </Text>
          {orgOverrides.map((prompt) => (
            <NavLink
              key={prompt._id}
              label={prompt.label}
              leftSection={TYPE_ICONS[prompt.type] ?? <IconFileText size={18} />}
              active={selectedId === prompt._id}
              onClick={() => onSelect(prompt._id)}
              variant="light"
            />
          ))}
        </>
      )}

      {isAdmin && (
        <>
          <Divider my="xs" />
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={onCreateNew}
            fullWidth
          >
            New Report Type
          </Button>
        </>
      )}
    </Stack>
  );
}
