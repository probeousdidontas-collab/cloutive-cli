import { notifications } from "@mantine/notifications";

const DEFAULT_AUTO_CLOSE = 5000;

/**
 * Show a success toast notification
 */
export function showSuccessToast(message: string, title?: string): void {
  notifications.show({
    title,
    message,
    color: "green",
    autoClose: DEFAULT_AUTO_CLOSE,
    withCloseButton: true,
  });
}

/**
 * Show an error toast notification
 */
export function showErrorToast(message: string, title?: string): void {
  notifications.show({
    title,
    message,
    color: "red",
    autoClose: DEFAULT_AUTO_CLOSE,
    withCloseButton: true,
  });
}

/**
 * Show an info toast notification
 */
export function showInfoToast(message: string, title?: string): void {
  notifications.show({
    title,
    message,
    color: "blue",
    autoClose: DEFAULT_AUTO_CLOSE,
    withCloseButton: true,
  });
}

/**
 * Show a warning toast notification
 */
export function showWarningToast(message: string, title?: string): void {
  notifications.show({
    title,
    message,
    color: "yellow",
    autoClose: DEFAULT_AUTO_CLOSE,
    withCloseButton: true,
  });
}
