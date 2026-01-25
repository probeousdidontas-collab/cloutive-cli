import { useContext } from "react";
import type { RootStore } from "./RootStore";
import { StoreContext } from "./StoreContext";

/**
 * useStores - Hook to access the RootStore from any component
 *
 * Must be used within a StoreProvider.
 *
 * Usage:
 * ```tsx
 * const stores = useStores();
 * // stores.sidebarOpen
 * ```
 *
 * @throws Error if used outside of StoreProvider
 */
export function useStores(): RootStore {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error(
      "useStores must be used within a StoreProvider. " +
        "Wrap your component tree with <StoreProvider>."
    );
  }

  return context;
}
