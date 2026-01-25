import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { LoadingSpinner } from "./LoadingSpinner";

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-044: LoadingSpinner Component", () => {
  describe("AC1: Add loading spinners for async operations", () => {
    test("should render loading spinner", () => {
      renderWithProviders(<LoadingSpinner />);
      
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    test("should display default loading message", () => {
      renderWithProviders(<LoadingSpinner />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test("should display custom loading message when provided", () => {
      renderWithProviders(<LoadingSpinner message="Fetching data..." />);
      
      expect(screen.getByText("Fetching data...")).toBeInTheDocument();
    });

    test("should render full page spinner when fullPage is true", () => {
      renderWithProviders(<LoadingSpinner fullPage />);
      
      const spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveAttribute("data-fullpage", "true");
    });

    test("should accept different sizes", () => {
      renderWithProviders(<LoadingSpinner size="lg" />);
      
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    test("should be accessible with proper aria attributes", () => {
      renderWithProviders(<LoadingSpinner message="Loading content" />);
      
      const spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveAttribute("aria-busy", "true");
      expect(spinner).toHaveAttribute("aria-live", "polite");
    });
  });
});
