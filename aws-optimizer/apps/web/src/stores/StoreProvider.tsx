import type { ReactNode } from "react";
import { getRootStore } from "./RootStore";
import { StoreContext } from "./StoreContext";

/**
 * StoreProvider - Wraps the application to provide MobX stores via context
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
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
