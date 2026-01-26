import { makeAutoObservable, runInAction } from "mobx";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

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
 * Active organization interface with full details from Better Auth.
 */
export interface ActiveOrganization {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  createdAt?: Date | string | number;
  metadata?: OrganizationMetadata;
  members?: OrganizationMember[];
  role?: string;
}

/**
 * Organization from the list of user's organizations.
 */
export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  role?: string;
}

/**
 * OrganizationStore - MobX store for managing organization state across the app.
 *
 * This store centralizes organization-related state to:
 * - Eliminate page reloads on organization switch
 * - Remove duplicated org resolution logic from pages
 * - Provide shared state between components
 *
 * Usage:
 * ```tsx
 * const { organizationStore } = useStores();
 * // Access via observer() or useOrganization() hook
 * ```
 */
export class OrganizationStore {
  /** The currently active organization from Better Auth */
  activeOrganization: ActiveOrganization | null = null;

  /** List of all organizations the user belongs to */
  organizations: Organization[] = [];

  /** The resolved Convex organization ID */
  convexOrgId: Id<"organizations"> | null = null;

  /** Whether organization data is being loaded */
  isLoading = true;

  /** Whether an organization switch is in progress */
  isSwitching = false;

  /** Whether the Convex org ID is being resolved */
  isResolvingConvexId = false;

  /** Error message if something went wrong */
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Whether the store is fully initialized and ready.
   * True when we have an active org and its Convex ID resolved.
   */
  get isReady(): boolean {
    return (
      !this.isLoading &&
      !this.isResolvingConvexId &&
      this.activeOrganization !== null &&
      this.convexOrgId !== null
    );
  }

  /**
   * Whether the store has finished initial loading (regardless of having an org).
   */
  get hasInitialized(): boolean {
    return !this.isLoading && !this.isResolvingConvexId;
  }

  /**
   * Set the active organization.
   */
  setActiveOrganization(org: ActiveOrganization | null): void {
    this.activeOrganization = org;
  }

  /**
   * Set the list of organizations.
   */
  setOrganizations(orgs: Organization[]): void {
    this.organizations = orgs;
  }

  /**
   * Set the Convex organization ID.
   */
  setConvexOrgId(id: Id<"organizations"> | null): void {
    this.convexOrgId = id;
  }

  /**
   * Set loading state.
   */
  setIsLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  /**
   * Set switching state.
   */
  setIsSwitching(switching: boolean): void {
    this.isSwitching = switching;
  }

  /**
   * Set resolving state.
   */
  setIsResolvingConvexId(resolving: boolean): void {
    this.isResolvingConvexId = resolving;
  }

  /**
   * Set error message.
   */
  setError(error: string | null): void {
    this.error = error;
  }

  /**
   * Reset the store to initial state.
   */
  reset(): void {
    runInAction(() => {
      this.activeOrganization = null;
      this.organizations = [];
      this.convexOrgId = null;
      this.isLoading = true;
      this.isSwitching = false;
      this.isResolvingConvexId = false;
      this.error = null;
    });
  }

  /**
   * Update the active organization after a switch.
   * This updates both the active org and finds it in the list.
   */
  switchToOrganization(orgId: string): void {
    const org = this.organizations.find((o) => o.id === orgId);
    if (org) {
      this.activeOrganization = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: org.role,
      };
      // Convex ID will be resolved by useOrganizationInit
      this.convexOrgId = null;
      this.isResolvingConvexId = true;
    }
  }

  /**
   * Add a new organization to the list and optionally set it as active.
   */
  addOrganization(org: Organization, setActive = false): void {
    runInAction(() => {
      this.organizations = [...this.organizations, org];
      if (setActive) {
        this.activeOrganization = {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          role: org.role,
        };
        this.convexOrgId = null;
        this.isResolvingConvexId = true;
      }
    });
  }
}
