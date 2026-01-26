import { makeAutoObservable } from "mobx";
import { OrganizationStore } from "./OrganizationStore";

/**
 * RootStore - Central container for all MobX stores
 *
 * This is the main entry point for state management. Domain stores
 * are instantiated here and made available via React context.
 *
 * Usage:
 * ```tsx
 * const stores = useStores();
 * // Access domain stores: stores.organizationStore
 * ```
 */
export class RootStore {
  // UI state
  sidebarOpen = true;

  // Domain stores
  organizationStore: OrganizationStore;

  constructor() {
    // Initialize domain stores
    this.organizationStore = new OrganizationStore();

    // Make this store observable, but exclude child stores
    // (they have their own makeAutoObservable)
    makeAutoObservable(this, {
      organizationStore: false,
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /** Dispose all stores */
  dispose(): void {
    // Reset organization store on dispose
    this.organizationStore.reset();
  }
}

// Singleton instance
let rootStoreInstance: RootStore | null = null;

/**
 * Get or create the singleton RootStore instance
 */
export function getRootStore(): RootStore {
  if (!rootStoreInstance) {
    rootStoreInstance = new RootStore();
  }
  return rootStoreInstance;
}

/**
 * Reset the singleton RootStore - for testing only
 */
export function _resetRootStore(): void {
  if (rootStoreInstance) {
    rootStoreInstance.dispose();
  }
  rootStoreInstance = null;
}
