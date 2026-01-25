import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock @mantine/notifications
const mockShowNotification = vi.fn();
vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: (props: unknown) => mockShowNotification(props),
  },
}));

// Import after mocking
import { showSuccessToast, showErrorToast, showInfoToast, showWarningToast } from "./notifications";

describe("US-044: Toast Notifications", () => {
  beforeEach(() => {
    mockShowNotification.mockClear();
  });

  describe("AC5: Add toast notifications for success/error feedback", () => {
    test("should show success toast with message", () => {
      showSuccessToast("Operation completed successfully");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Operation completed successfully",
          color: "green",
        })
      );
    });

    test("should show success toast with custom title", () => {
      showSuccessToast("Data saved", "Success!");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Data saved",
          title: "Success!",
          color: "green",
        })
      );
    });

    test("should show error toast with message", () => {
      showErrorToast("Failed to save data");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to save data",
          color: "red",
        })
      );
    });

    test("should show error toast with custom title", () => {
      showErrorToast("Connection failed", "Network Error");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Connection failed",
          title: "Network Error",
          color: "red",
        })
      );
    });

    test("should show info toast with message", () => {
      showInfoToast("New updates available");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "New updates available",
          color: "blue",
        })
      );
    });

    test("should show warning toast with message", () => {
      showWarningToast("Your session will expire soon");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Your session will expire soon",
          color: "yellow",
        })
      );
    });

    test("should include auto-close duration", () => {
      showSuccessToast("Done");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          autoClose: expect.any(Number),
        })
      );
    });

    test("should include withCloseButton option", () => {
      showErrorToast("Error");
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          withCloseButton: true,
        })
      );
    });
  });
});
