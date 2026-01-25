import { Button, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { 
  IconInbox, 
  IconSearch, 
  IconFileOff, 
  IconCloudOff,
  IconBell,
} from "@tabler/icons-react";

export type EmptyStateVariant = "default" | "search" | "filtered" | "offline" | "notifications";
export type EmptyStateIcon = "inbox" | "search" | "file" | "cloud" | "bell";

const ICONS: Record<EmptyStateIcon, React.ReactNode> = {
  inbox: <IconInbox size={48} />,
  search: <IconSearch size={48} />,
  file: <IconFileOff size={48} />,
  cloud: <IconCloudOff size={48} />,
  bell: <IconBell size={48} />,
};

const VARIANT_ICONS: Record<EmptyStateVariant, EmptyStateIcon> = {
  default: "inbox",
  search: "search",
  filtered: "search",
  offline: "cloud",
  notifications: "bell",
};

export interface EmptyStateProps {
  /** Title for the empty state */
  title: string;
  /** Optional description */
  description?: string;
  /** Icon to display */
  icon?: EmptyStateIcon;
  /** Variant for preset styling */
  variant?: EmptyStateVariant;
  /** Label for action button */
  actionLabel?: string;
  /** Callback when action button is clicked */
  onAction?: () => void;
}

export function EmptyState({ 
  title, 
  description,
  icon,
  variant = "default",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const iconKey = icon ?? VARIANT_ICONS[variant];
  const IconComponent = ICONS[iconKey];

  return (
    <Paper
      data-testid="empty-state"
      data-variant={variant}
      withBorder
      p="xl"
    >
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon 
          data-testid="empty-state-icon"
          variant="light" 
          color="gray" 
          size={80} 
          radius="xl"
        >
          {IconComponent}
        </ThemeIcon>
        <Text fw={600} size="lg" ta="center">
          {title}
        </Text>
        {description && (
          <Text c="dimmed" size="sm" ta="center" maw={400}>
            {description}
          </Text>
        )}
        {actionLabel && onAction && (
          <Button variant="light" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default EmptyState;
