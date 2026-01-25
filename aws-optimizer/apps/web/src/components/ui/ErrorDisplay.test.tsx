import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ErrorDisplay } from "./ErrorDisplay";

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-044: ErrorDisplay Component", () => {
  describe("AC2: Display error messages with retry options", () => {
    test("should render error display", () => {
      renderWithProviders(<ErrorDisplay message="Something went wrong" />);
      
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    test("should display error message", () => {
      renderWithProviders(<ErrorDisplay message="Failed to load data" />);
      
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    });

    test("should display retry button when onRetry is provided", () => {
      const onRetry = vi.fn();
      renderWithProviders(<ErrorDisplay message="Error" onRetry={onRetry} />);
      
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    test("should call onRetry when retry button is clicked", () => {
      const onRetry = vi.fn();
      renderWithProviders(<ErrorDisplay message="Error" onRetry={onRetry} />);
      
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test("should not display retry button when onRetry is not provided", () => {
      renderWithProviders(<ErrorDisplay message="Error" />);
      
      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    });

    test("should display custom title when provided", () => {
      renderWithProviders(<ErrorDisplay title="Connection Error" message="Unable to connect" />);
      
      expect(screen.getByText("Connection Error")).toBeInTheDocument();
    });

    test("should display default title when not provided", () => {
      renderWithProviders(<ErrorDisplay message="Something went wrong" />);
      
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    test("should have error icon visible", () => {
      renderWithProviders(<ErrorDisplay message="Error occurred" />);
      
      expect(screen.getByTestId("error-icon")).toBeInTheDocument();
    });
  });

  describe("AC3: Handle network errors gracefully", () => {
    test("should display network error message appropriately", () => {
      renderWithProviders(
        <ErrorDisplay 
          message="Unable to reach the server" 
          variant="network"
        />
      );
      
      expect(screen.getByText("Network Error")).toBeInTheDocument();
      expect(screen.getByText("Unable to reach the server")).toBeInTheDocument();
    });

    test("should show helpful suggestion for network errors", () => {
      renderWithProviders(
        <ErrorDisplay 
          message="Connection failed" 
          variant="network"
        />
      );
      
      expect(screen.getByText(/check your connection/i)).toBeInTheDocument();
    });
  });
});
