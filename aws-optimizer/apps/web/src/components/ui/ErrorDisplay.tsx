import { Alert, Button, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconAlertCircle, IconRefresh, IconWifi } from "@tabler/icons-react";

export interface ErrorDisplayProps {
  /** Error message to display */
  message: string;
  /** Custom title for the error */
  title?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Error variant for different styling */
  variant?: "default" | "network";
}

export function ErrorDisplay({ 
  message, 
  title,
  onRetry,
  variant = "default"
}: ErrorDisplayProps) {
  const isNetwork = variant === "network";
  const displayTitle = title ?? (isNetwork ? "Network Error" : "Error");
  
  return (
    <Alert
      data-testid="error-display"
      color="red"
      variant="light"
      icon={
        <ThemeIcon data-testid="error-icon" color="red" variant="light" size="lg">
          {isNetwork ? <IconWifi size={20} /> : <IconAlertCircle size={20} />}
        </ThemeIcon>
      }
    >
      <Stack gap="sm">
        <Text fw={600}>{displayTitle}</Text>
        <Text size="sm">{message}</Text>
        {isNetwork && (
          <Text size="xs" c="dimmed">
            Please check your connection and try again.
          </Text>
        )}
        {onRetry && (
          <Button
            variant="light"
            color="red"
            size="sm"
            leftSection={<IconRefresh size={16} />}
            onClick={onRetry}
            style={{ alignSelf: "flex-start" }}
          >
            Retry
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

export default ErrorDisplay;
