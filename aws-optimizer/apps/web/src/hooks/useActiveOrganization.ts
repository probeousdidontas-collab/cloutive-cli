import { useState, useEffect, useCallback } from "react";
import { organizationMethods, IS_TEST_MODE } from "../lib/auth-client";

/**
 * Organization metadata interface for settings and preferences.
 */
export interface OrganizationMetadata {
  plan?: string;
  enableNotifications?: boolean;
  defaultRegion?: string;
  notificationPreferences?: {
    emailFrequency: string;
    alertTypes: string[];
  };
  maxUsers?: number;
  customDomain?: string;
}

/**
 * Organization member interface from Better Auth.
 */
export interface OrganizationMember {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

/**
 * Active organization interface with full details.
 */
export interface ActiveOrganization {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  createdAt?: Date | string | number;
  metadata?: OrganizationMetadata;
  members?: OrganizationMember[];
}

/**
 * Return type for the useActiveOrganization hook.
 */
export interface UseActiveOrganizationResult {
  /** The active organization data, or null if not loaded */
  organization: ActiveOrganization | null;
  /** Whether the organization is currently being fetched */
  isLoading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Function to manually refetch the organization */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage the active organization from Better Auth.
 * 
 * This hook handles:
 * - Fetching the active organization on mount
 * - Loading and error states
 * - Test mode support
 * - Manual refetch capability
 * 
 * @param isAuthenticated - Whether the user is currently authenticated
 * @returns Object with organization data, loading state, error, and refetch function
 * 
 * @example
 * ```tsx
 * const { organization, isLoading, error, refetch } = useActiveOrganization(isAuthenticated);
 * 
 * if (isLoading) return <Loader />;
 * if (error) return <ErrorMessage message={error} />;
 * if (!organization) return <NoOrganizationMessage />;
 * 
 * return <div>Organization: {organization.name}</div>;
 * ```
 */
export function useActiveOrganization(isAuthenticated: boolean): UseActiveOrganizationResult {
  const [organization, setOrganization] = useState<ActiveOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    // Don't fetch if not authenticated (unless in test mode)
    if (!isAuthenticated && !IS_TEST_MODE) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await organizationMethods.getActive();
      
      if (result.error) {
        setError(result.error.message || "Failed to fetch organization");
        setOrganization(null);
      } else if (result.data) {
        // Cast to access optional properties that may exist on the response
        const data = result.data as {
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
        setOrganization({
          id: data.id,
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          createdAt: data.createdAt,
          metadata: data.metadata as OrganizationMetadata | undefined,
          members: data.members as OrganizationMember[] | undefined,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch organization";
      console.error("Failed to fetch active organization:", err);
      setError(errorMessage);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch organization on mount and when authentication changes
  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  return {
    organization,
    isLoading,
    error,
    refetch: fetchOrganization,
  };
}

export default useActiveOrganization;
