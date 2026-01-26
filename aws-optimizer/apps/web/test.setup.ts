import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom";

// Re-export vitest functions for convenience
export { expect, test, describe, beforeEach, afterEach, vi };

// Mock window.matchMedia for Mantine components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Mantine components
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;

// Mock useOrganization hook for simpler test setup
// This is used by components that have been migrated to use the MobX store
vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrganization: {
      id: "test-org-id",
      name: "Test Organization",
      slug: "test-org",
      role: "owner",
    },
    organizations: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
    convexOrgId: "test-org-id",
    isLoading: false,
    isSwitching: false,
    isReady: true,
    error: null,
    switchOrganization: vi.fn().mockResolvedValue(true),
    createOrganization: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock useOrganizationInit hook (does nothing in tests)
vi.mock("@/hooks/useOrganizationInit", () => ({
  useOrganizationInit: () => {},
}));

// Mock MobX stores
vi.mock("@/stores/useStores", () => ({
  useStores: () => ({
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
    organizationStore: {
      activeOrganization: {
        id: "test-org-id",
        name: "Test Organization",
        slug: "test-org",
        role: "owner",
      },
      organizations: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
      convexOrgId: "test-org-id",
      isLoading: false,
      isSwitching: false,
      isResolvingConvexId: false,
      isReady: true,
      hasInitialized: true,
      error: null,
      setActiveOrganization: vi.fn(),
      setOrganizations: vi.fn(),
      setConvexOrgId: vi.fn(),
      setIsLoading: vi.fn(),
      setIsSwitching: vi.fn(),
      setIsResolvingConvexId: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn(),
      switchToOrganization: vi.fn(),
      addOrganization: vi.fn(),
    },
  }),
}));

// Helper to create auth-client mock with organizationMethods
// Individual test files can use this to extend their mocks
export const createAuthClientMock = (overrides = {}) => ({
  IS_TEST_MODE: true,
  useSession: () => ({
    data: {
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
      },
    },
    isPending: false,
  }),
  organizationMethods: {
    list: vi.fn().mockResolvedValue({
      data: [{ id: "test-org-id", name: "Test Organization", slug: "test-org", role: "owner" }],
      error: null,
    }),
    getActive: vi.fn().mockResolvedValue({
      data: {
        id: "test-org-id",
        name: "Test Organization",
        slug: "test-org",
        logo: null,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        metadata: {
          plan: "professional",
          defaultRegion: "us-east-1",
          enableNotifications: true,
        },
      },
      error: null,
    }),
    setActive: vi.fn().mockResolvedValue({ data: { organizationId: "test-org-id" }, error: null }),
    create: vi.fn().mockResolvedValue({ data: { id: "new-org-id", name: "New Org", slug: "new-org" }, error: null }),
    update: vi.fn().mockResolvedValue({ data: { id: "test-org-id", name: "Updated Org" }, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    inviteMember: vi.fn().mockResolvedValue({ data: {}, error: null }),
    acceptInvitation: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    updateMemberRole: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    removeMember: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    getFullOrganization: vi.fn().mockResolvedValue({
      data: {
        id: "test-org-id",
        name: "Test Organization",
        slug: "test-org",
        members: [{ id: "test-user-id", name: "Test User", email: "test@example.com", role: "owner" }],
      },
      error: null,
    }),
  },
  ...overrides,
});
