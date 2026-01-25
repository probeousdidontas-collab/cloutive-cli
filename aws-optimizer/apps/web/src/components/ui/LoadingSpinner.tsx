import { Center, Loader, Stack, Text } from "@mantine/core";

export interface LoadingSpinnerProps {
  /** Custom loading message */
  message?: string;
  /** Whether to render as full page overlay */
  fullPage?: boolean;
  /** Size of the spinner */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function LoadingSpinner({ 
  message = "Loading...", 
  fullPage = false,
  size = "md" 
}: LoadingSpinnerProps) {
  const content = (
    <Stack align="center" gap="sm">
      <Loader size={size} />
      <Text size="sm" c="dimmed">
        {message}
      </Text>
    </Stack>
  );

  if (fullPage) {
    return (
      <Center
        data-testid="loading-spinner"
        data-fullpage="true"
        aria-busy="true"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          zIndex: 1000,
        }}
      >
        {content}
      </Center>
    );
  }

  return (
    <Center
      data-testid="loading-spinner"
      aria-busy="true"
      aria-live="polite"
      py="xl"
    >
      {content}
    </Center>
  );
}

export default LoadingSpinner;
