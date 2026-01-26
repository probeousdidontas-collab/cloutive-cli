import { useEffect, useCallback, useRef } from "react";
import { runInAction } from "mobx";
import { useMutation } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";
import { organizationMethods, IS_TEST_MODE } from "../lib/auth-client";
import { useStores } from "../stores/useStores";
import type { ActiveOrganization, Organization } from "../stores/OrganizationStore";

/**
 * useOrganizationInit - Hook to initialize and sync organization state with the MobX store.
 *
 * This hook should be called once at the app root level (e.g., in StoreProvider or App).
 * It handles:
 * - Fetching organizations list from Better Auth
 * - Fetching active organization from Better Auth
 * - Resolving Convex org ID via api.organizations.getOrCreateByBetterAuthId
 * - Updating store on auth state changes
 * - Re-resolving Convex ID when active org changes
 *
 * @param isAuthenticated - Whether the user is currently authenticated
 */
export function useOrganizationInit(isAuthenticated: boolean): void {
  const { organizationStore } = useStores();
  const getOrCreateOrg = useMutation(api.organizations.getOrCreateByBetterAuthId);

  // Track previous active org ID to detect changes
  const prevActiveOrgIdRef = useRef<string | null>(null);

  // Fetch organizations and active organization from Better Auth
  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated && !IS_TEST_MODE) {
      runInAction(() => {
        organizationStore.setIsLoading(false);
        organizationStore.setActiveOrganization(null);
        organizationStore.setOrganizations([]);
        organizationStore.setConvexOrgId(null);
      });
      return;
    }

    runInAction(() => {
      organizationStore.setIsLoading(true);
      organizationStore.setError(null);
    });

    try {
      // Fetch organizations list
      const listResult = await organizationMethods.list();
      let orgs: Organization[] = [];

      if (listResult.data) {
        orgs = (listResult.data as Organization[]).map((org) => ({
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

      // Fetch active organization
      let activeOrg: ActiveOrganization | null = null;
      try {
        const activeResult = await organizationMethods.getActive();
        if (activeResult.data?.id) {
          const data = activeResult.data as {
            id: string;
            name: string;
            slug?: string | null;
            logo?: string | null;
            createdAt?: Date | string | number;
            metadata?: Record<string, unknown>;
            members?: Array<{
              id: string;
              userId?: string;
              name?: string;
              email?: string;
              role?: string;
              user?: { id: string; name: string; email: string; image?: string | null };
            }>;
          };

          // Find role from the organizations list
          const orgFromList = orgs.find((o) => o.id === data.id);

          activeOrg = {
            id: data.id,
            name: data.name,
            slug: data.slug,
            logo: data.logo,
            createdAt: data.createdAt,
            metadata: data.metadata as ActiveOrganization["metadata"],
            members: data.members,
            role: orgFromList?.role,
          };
        } else if (orgs.length > 0) {
          // No active org but user has orgs - set the first one as active
          const firstOrg = orgs[0];
          await organizationMethods.setActive(firstOrg.id);
          activeOrg = {
            id: firstOrg.id,
            name: firstOrg.name,
            slug: firstOrg.slug,
            logo: firstOrg.logo,
            role: firstOrg.role,
          };
        }
      } catch {
        // If getActive fails, try to set first org as active
        if (orgs.length > 0) {
          const firstOrg = orgs[0];
          try {
            await organizationMethods.setActive(firstOrg.id);
          } catch {
            // Ignore setActive errors - just use locally
          }
          activeOrg = {
            id: firstOrg.id,
            name: firstOrg.name,
            slug: firstOrg.slug,
            logo: firstOrg.logo,
            role: firstOrg.role,
          };
        }
      }

      runInAction(() => {
        organizationStore.setActiveOrganization(activeOrg);
        organizationStore.setIsLoading(false);
      });

      // Store the active org ID for tracking changes
      prevActiveOrgIdRef.current = activeOrg?.id ?? null;
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      runInAction(() => {
        organizationStore.setError(
          error instanceof Error ? error.message : "Failed to fetch organizations"
        );
        organizationStore.setIsLoading(false);
      });
    }
  }, [isAuthenticated, organizationStore]);

  // Resolve Better Auth org ID to Convex org ID
  const resolveConvexOrgId = useCallback(async () => {
    const activeOrg = organizationStore.activeOrganization;

    if (!activeOrg?.id || !activeOrg?.name) {
      runInAction(() => {
        organizationStore.setConvexOrgId(null);
        organizationStore.setIsResolvingConvexId(false);
      });
      return;
    }

    // In test mode, use a mock ID
    if (IS_TEST_MODE) {
      runInAction(() => {
        organizationStore.setConvexOrgId("test-org-id" as Id<"organizations">);
        organizationStore.setIsResolvingConvexId(false);
      });
      return;
    }

    runInAction(() => {
      organizationStore.setIsResolvingConvexId(true);
    });

    try {
      const orgId = await getOrCreateOrg({
        betterAuthOrgId: activeOrg.id,
        name: activeOrg.name,
        slug: activeOrg.slug || undefined,
      });
      runInAction(() => {
        organizationStore.setConvexOrgId(orgId);
        organizationStore.setIsResolvingConvexId(false);
      });
    } catch (error) {
      console.error("Failed to resolve organization:", error);
      runInAction(() => {
        organizationStore.setConvexOrgId(null);
        organizationStore.setIsResolvingConvexId(false);
        organizationStore.setError("Failed to resolve organization");
      });
    }
  }, [organizationStore, getOrCreateOrg]);

  // Initialize on mount and when authentication changes
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Resolve Convex org ID when active organization changes
  useEffect(() => {
    const currentOrgId = organizationStore.activeOrganization?.id ?? null;

    // Only resolve if we have an active org and it's different from previous
    // or if we haven't resolved yet (convexOrgId is null but we have an active org)
    if (
      !organizationStore.isLoading &&
      organizationStore.activeOrganization &&
      (organizationStore.convexOrgId === null || currentOrgId !== prevActiveOrgIdRef.current)
    ) {
      prevActiveOrgIdRef.current = currentOrgId;
      resolveConvexOrgId();
    }
  }, [
    organizationStore.isLoading,
    organizationStore.activeOrganization,
    organizationStore.convexOrgId,
    resolveConvexOrgId,
  ]);
}
