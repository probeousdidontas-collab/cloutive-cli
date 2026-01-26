import { useCallback } from "react";
import { runInAction } from "mobx";
import { useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { organizationMethods, IS_TEST_MODE } from "../lib/auth-client";
import { useStores } from "../stores/useStores";
import { showSuccessToast, showErrorToast } from "../lib/notifications";
import type {
  ActiveOrganization,
  Organization,
  OrganizationMember,
  OrganizationMetadata,
} from "../stores/OrganizationStore";

/**
 * Return type for the useOrganization hook.
 */
export interface UseOrganizationResult {
  /** The currently active organization */
  activeOrganization: ActiveOrganization | null;
  /** List of all organizations the user belongs to */
  organizations: Organization[];
  /** The resolved Convex organization ID */
  convexOrgId: Id<"organizations"> | null;
  /** Whether organization data is being loaded */
  isLoading: boolean;
  /** Whether an organization switch is in progress */
  isSwitching: boolean;
  /** Whether the store is fully ready (has org + convex ID) */
  isReady: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Switch to a different organization */
  switchOrganization: (orgId: string) => Promise<boolean>;
  /** Create a new organization and optionally switch to it */
  createOrganization: (name: string, switchToNew?: boolean) => Promise<boolean>;
  /** Refresh organization data */
  refresh: () => Promise<void>;
}

/**
 * useOrganization - Convenience hook for components that need organization data.
 *
 * This hook provides read access to organization state from the MobX store,
 * plus actions for switching and creating organizations.
 *
 * Components using this hook should be wrapped with observer() from mobx-react-lite
 * to react to state changes.
 *
 * @example
 * ```tsx
 * import { observer } from "mobx-react-lite";
 * import { useOrganization } from "../hooks/useOrganization";
 *
 * export const MyComponent = observer(function MyComponent() {
 *   const { activeOrganization, convexOrgId, isReady, switchOrganization } = useOrganization();
 *
 *   if (!isReady) return <Loader />;
 *
 *   return (
 *     <div>
 *       <h1>{activeOrganization?.name}</h1>
 *       <button onClick={() => switchOrganization("other-org-id")}>
 *         Switch Org
 *       </button>
 *     </div>
 *   );
 * });
 * ```
 */
export function useOrganization(): UseOrganizationResult {
  const { organizationStore } = useStores();
  const getOrCreateOrg = useMutation(api.organizations.getOrCreateByBetterAuthId);

  /**
   * Switch to a different organization.
   * Updates Better Auth and the MobX store, then resolves the Convex org ID.
   */
  const switchOrganization = useCallback(
    async (orgId: string): Promise<boolean> => {
      const org = organizationStore.organizations.find((o) => o.id === orgId);
      if (!org) {
        showErrorToast("Organization not found");
        return false;
      }

      if (orgId === organizationStore.activeOrganization?.id) {
        return true; // Already active
      }

      runInAction(() => {
        organizationStore.setIsSwitching(true);
        organizationStore.setError(null);
      });

      try {
        // Update Better Auth
        const result = await organizationMethods.setActive(orgId);
        if (result.error) {
          showErrorToast(`Failed to switch organization: ${result.error.message}`);
          runInAction(() => {
            organizationStore.setIsSwitching(false);
          });
          return false;
        }

        // Update store
        runInAction(() => {
          organizationStore.setActiveOrganization({
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            role: org.role,
          });
          organizationStore.setConvexOrgId(null);
          organizationStore.setIsResolvingConvexId(true);
        });

        // Resolve Convex org ID
        if (!IS_TEST_MODE) {
          const convexOrgId = await getOrCreateOrg({
            betterAuthOrgId: org.id,
            name: org.name,
            slug: org.slug || undefined,
          });
          runInAction(() => {
            organizationStore.setConvexOrgId(convexOrgId);
          });
        } else {
          runInAction(() => {
            organizationStore.setConvexOrgId("test-org-id" as Id<"organizations">);
          });
        }

        runInAction(() => {
          organizationStore.setIsResolvingConvexId(false);
          organizationStore.setIsSwitching(false);
        });

        showSuccessToast(`Switched to ${org.name}`);
        return true;
      } catch (error) {
        console.error("Failed to switch organization:", error);
        showErrorToast("Failed to switch organization");
        runInAction(() => {
          organizationStore.setIsSwitching(false);
          organizationStore.setIsResolvingConvexId(false);
        });
        return false;
      }
    },
    [organizationStore, getOrCreateOrg]
  );

  /**
   * Create a new organization and optionally switch to it.
   */
  const createOrganization = useCallback(
    async (name: string, switchToNew = true): Promise<boolean> => {
      if (!name.trim()) {
        showErrorToast("Organization name is required");
        return false;
      }

      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      try {
        const result = await organizationMethods.create(name, slug);
        if (result.error) {
          showErrorToast(`Failed to create organization: ${result.error.message}`);
          return false;
        }

        if (!result.data?.id) {
          showErrorToast("Failed to create organization");
          return false;
        }

        const newOrg: Organization = {
          id: result.data.id,
          name,
          slug,
          role: "owner",
        };

        // Add to list
        runInAction(() => {
          organizationStore.setOrganizations([...organizationStore.organizations, newOrg]);
        });

        if (switchToNew) {
          // Set as active via Better Auth
          const setActiveResult = await organizationMethods.setActive(result.data.id);
          if (setActiveResult.error) {
            showSuccessToast(`Organization "${name}" created`);
            showErrorToast(`Failed to auto-switch: ${setActiveResult.error.message}`);
            return true;
          }

          // Update store
          runInAction(() => {
            organizationStore.setActiveOrganization({
              id: newOrg.id,
              name: newOrg.name,
              slug: newOrg.slug,
              logo: newOrg.logo,
              role: newOrg.role,
            });
            organizationStore.setConvexOrgId(null);
            organizationStore.setIsResolvingConvexId(true);
          });

          // Resolve Convex org ID
          if (!IS_TEST_MODE) {
            const convexOrgId = await getOrCreateOrg({
              betterAuthOrgId: newOrg.id,
              name: newOrg.name,
              slug: newOrg.slug || undefined,
            });
            runInAction(() => {
              organizationStore.setConvexOrgId(convexOrgId);
            });
          } else {
            runInAction(() => {
              organizationStore.setConvexOrgId("test-org-id" as Id<"organizations">);
            });
          }

          runInAction(() => {
            organizationStore.setIsResolvingConvexId(false);
          });

          showSuccessToast(`Organization "${name}" created and activated`);
        } else {
          showSuccessToast(`Organization "${name}" created`);
        }

        return true;
      } catch (error) {
        console.error("Failed to create organization:", error);
        showErrorToast("Failed to create organization");
        return false;
      }
    },
    [organizationStore, getOrCreateOrg]
  );

  /**
   * Refresh organization data from Better Auth.
   */
  const refresh = useCallback(async (): Promise<void> => {
    runInAction(() => {
      organizationStore.setIsLoading(true);
      organizationStore.setError(null);
    });

    try {
      // Fetch organizations list
      const listResult = await organizationMethods.list();
      if (listResult.data) {
        const orgs = (listResult.data as Organization[]).map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          role: org.role,
        }));
        runInAction(() => {
          organizationStore.setOrganizations(orgs);
        });
      }

      // Refresh active organization
      const activeResult = await organizationMethods.getActive();
      if (activeResult.data?.id) {
        const data = activeResult.data as {
          id: string;
          name: string;
          slug?: string | null;
          logo?: string | null;
          createdAt?: Date | string | number;
          metadata?: Record<string, unknown>;
          members?: OrganizationMember[];
        };

        const orgFromList = organizationStore.organizations.find((o) => o.id === data.id);

        runInAction(() => {
          organizationStore.setActiveOrganization({
            id: data.id,
            name: data.name,
            slug: data.slug,
            logo: data.logo,
            createdAt: data.createdAt,
            metadata: data.metadata as OrganizationMetadata,
            members: data.members,
            role: orgFromList?.role,
          });
        });
      }
    } catch (error) {
      console.error("Failed to refresh organizations:", error);
      runInAction(() => {
        organizationStore.setError(
          error instanceof Error ? error.message : "Failed to refresh organizations"
        );
      });
    } finally {
      runInAction(() => {
        organizationStore.setIsLoading(false);
      });
    }
  }, [organizationStore]);

  return {
    activeOrganization: organizationStore.activeOrganization,
    organizations: organizationStore.organizations,
    convexOrgId: organizationStore.convexOrgId,
    isLoading: organizationStore.isLoading,
    isSwitching: organizationStore.isSwitching,
    isReady: organizationStore.isReady,
    error: organizationStore.error,
    switchOrganization,
    createOrganization,
    refresh,
  };
}
