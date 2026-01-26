import type { ReactNode } from "react";
import { getRootStore } from "./RootStore";
import { StoreContext } from "./StoreContext";
import { useSession } from "../lib/auth-client";
import { useOrganizationInit } from "../hooks/useOrganizationInit";

/**
 * OrganizationInitializer - Internal component that initializes organization state.
 * This is separated to ensure hooks are called within the StoreContext.
 */
function OrganizationInitializer({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !isPending && session !== null;

  // Initialize organization state
  useOrganizationInit(isAuthenticated);

  return <>{children}</>;
}

/**
 * StoreProvider - Wraps the application to provide MobX stores via context
 *
 * This provider:
 * - Creates and provides the MobX RootStore via context
 * - Initializes organization state from Better Auth
 * - Resolves Convex organization IDs
 *
 * Usage:
 * ```tsx
 * <StoreProvider>
 *   <App />
 * </StoreProvider>
 * ```
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = getRootStore();

  return (
    <StoreContext.Provider value={store}>
      <OrganizationInitializer>{children}</OrganizationInitializer>
    </StoreContext.Provider>
  );
}
