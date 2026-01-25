import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { EmptyState } from "./EmptyState";

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-044: EmptyState Component", () => {
  describe("AC4: Show empty states for lists with no data", () => {
    test("should render empty state", () => {
      renderWithProviders(<EmptyState title="No items" />);
      
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    test("should display title", () => {
      renderWithProviders(<EmptyState title="No data available" />);
      
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    test("should display description when provided", () => {
      renderWithProviders(
        <EmptyState 
          title="No items" 
          description="Start by adding your first item" 
        />
      );
      
      expect(screen.getByText("Start by adding your first item")).toBeInTheDocument();
    });

    test("should display action button when provided", () => {
      const onAction = vi.fn();
      renderWithProviders(
        <EmptyState 
          title="No items" 
          actionLabel="Add Item"
          onAction={onAction}
        />
      );
      
      expect(screen.getByRole("button", { name: "Add Item" })).toBeInTheDocument();
    });

    test("should call onAction when action button is clicked", () => {
      const onAction = vi.fn();
      renderWithProviders(
        <EmptyState 
          title="No items" 
          actionLabel="Add Item"
          onAction={onAction}
        />
      );
      
      fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
      
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    test("should display icon when provided", () => {
      renderWithProviders(
        <EmptyState 
          title="No items" 
          icon="inbox"
        />
      );
      
      expect(screen.getByTestId("empty-state-icon")).toBeInTheDocument();
    });

    test("should support different variants", () => {
      renderWithProviders(
        <EmptyState 
          title="No results" 
          variant="search"
        />
      );
      
      expect(screen.getByTestId("empty-state")).toHaveAttribute("data-variant", "search");
    });
  });
});
