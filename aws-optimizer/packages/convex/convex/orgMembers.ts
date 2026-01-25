/**
 * Organization Member Management
 *
 * Implements US-009: Implement organization member management
 *
 * Features:
 * - Invite new members to an organization
 * - Update member roles (with role hierarchy enforcement)
 * - Remove members (with last owner protection)
 * - List members with user details
 *
 * Role hierarchy: owner > admin > member > viewer
 * - Owners can manage all roles
 * - Admins can manage member/viewer roles only
 * - Members and viewers cannot manage roles
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Role hierarchy (higher index = higher privilege)
const ROLE_HIERARCHY = ["viewer", "member", "admin", "owner"] as const;
type OrgMemberRole = (typeof ROLE_HIERARCHY)[number];

// Roles that can manage members (invite, update, remove)
const MANAGEMENT_ROLES = ["owner", "admin"] as const;

// Organization member role validator
const orgMemberRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer")
);

/**
 * Get role hierarchy index (higher = more privileged)
 */
function getRoleLevel(role: OrgMemberRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if actor can manage target based on role hierarchy.
 * Owners can manage anyone. Admins can manage members/viewers only.
 */
function canManage(actorRole: OrgMemberRole, targetRole: OrgMemberRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") {
    return getRoleLevel(targetRole) < getRoleLevel("admin");
  }
  return false;
}

/**
 * Check if actor can assign a specific role.
 * Owners can assign any role. Admins can assign member/viewer only.
 */
function canAssignRole(actorRole: OrgMemberRole, targetRole: OrgMemberRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") {
    return getRoleLevel(targetRole) < getRoleLevel("admin");
  }
  return false;
}

/**
 * Helper to get a user's membership in an organization.
 */
async function getMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<Doc<"orgMembers"> | null> {
  return await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .first();
}

/**
 * Count owners in an organization.
 */
async function countOwners(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<number> {
  const members = await ctx.db
    .query("orgMembers")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  
  return members.filter((m) => m.role === "owner").length;
}

/**
 * List all members of an organization.
 * Returns members with user details.
 * All members (including viewers) can list members.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = args;

    // Check if the requesting user is a member
    const membership = await getMembership(ctx, organizationId, userId);
    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Get all members
    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Fetch user details for each member
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          _id: member._id,
          organizationId: member.organizationId,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                email: user.email,
                image: user.image,
              }
            : null,
        };
      })
    );

    return membersWithUsers.filter((m) => m.user !== null);
  },
});

/**
 * Invite a new member to an organization.
 * Only owners and admins can invite.
 * Admins cannot invite owners.
 */
export const invite = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"), // The user performing the action
    inviteeEmail: v.string(),
    role: orgMemberRoleValidator,
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, inviteeEmail, role } = args;
    const now = Date.now();

    // Get the actor's membership
    const actorMembership = await getMembership(ctx, organizationId, userId);
    if (!actorMembership) {
      throw new Error("You are not a member of this organization");
    }

    // Check if actor has management permissions
    const actorRole = actorMembership.role as OrgMemberRole;
    if (!MANAGEMENT_ROLES.includes(actorRole as typeof MANAGEMENT_ROLES[number])) {
      throw new Error("You do not have permission to invite members");
    }

    // Check if actor can assign the requested role
    if (!canAssignRole(actorRole, role as OrgMemberRole)) {
      throw new Error(`You do not have permission to invite members with the ${role} role`);
    }

    // Find the invitee by email
    const invitee = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", inviteeEmail))
      .first();

    if (!invitee) {
      throw new Error(`User with email ${inviteeEmail} not found`);
    }

    // Check if user is already a member
    const existingMembership = await getMembership(ctx, organizationId, invitee._id);
    if (existingMembership) {
      throw new Error("User is already a member of this organization");
    }

    // Create the membership
    const membershipId = await ctx.db.insert("orgMembers", {
      organizationId,
      userId: invitee._id,
      role,
      createdAt: now,
      updatedAt: now,
    });

    // TODO: Send invite email via Resend component
    // This would be done via an action that calls the Resend API
    // For now, we just create the membership

    return { membershipId };
  },
});

/**
 * Update a member's role.
 * Only owners and admins can update roles.
 * Admins cannot promote to owner or modify admin/owner roles.
 */
export const updateRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"), // The user performing the action
    memberId: v.id("orgMembers"),
    newRole: orgMemberRoleValidator,
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, memberId, newRole } = args;

    // Get the actor's membership
    const actorMembership = await getMembership(ctx, organizationId, userId);
    if (!actorMembership) {
      throw new Error("You are not a member of this organization");
    }

    // Check if actor has management permissions
    const actorRole = actorMembership.role as OrgMemberRole;
    if (!MANAGEMENT_ROLES.includes(actorRole as typeof MANAGEMENT_ROLES[number])) {
      throw new Error("You do not have permission to update member roles");
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(memberId);
    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Verify the membership belongs to this organization
    if (targetMembership.organizationId !== organizationId) {
      throw new Error("Member does not belong to this organization");
    }

    const targetRole = targetMembership.role as OrgMemberRole;

    // Check if actor can manage the target's current role
    if (!canManage(actorRole, targetRole)) {
      throw new Error("You do not have permission to modify this member's role");
    }

    // Check if actor can assign the new role
    if (!canAssignRole(actorRole, newRole as OrgMemberRole)) {
      throw new Error(`You do not have permission to assign the ${newRole} role`);
    }

    // Update the role
    await ctx.db.patch(memberId, {
      role: newRole,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Remove a member from an organization.
 * Only owners and admins can remove members.
 * Admins cannot remove owners or other admins.
 * Cannot remove the last owner.
 * Members can remove themselves.
 */
export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"), // The user performing the action
    memberId: v.id("orgMembers"),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, memberId } = args;

    // Get the actor's membership
    const actorMembership = await getMembership(ctx, organizationId, userId);
    if (!actorMembership) {
      throw new Error("You are not a member of this organization");
    }

    // Get the target membership
    const targetMembership = await ctx.db.get(memberId);
    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Verify the membership belongs to this organization
    if (targetMembership.organizationId !== organizationId) {
      throw new Error("Member does not belong to this organization");
    }

    const actorRole = actorMembership.role as OrgMemberRole;
    const targetRole = targetMembership.role as OrgMemberRole;

    // Check if removing self
    const isSelfRemoval = actorMembership._id === memberId;

    if (!isSelfRemoval) {
      // Check if actor has management permissions
      if (!MANAGEMENT_ROLES.includes(actorRole as typeof MANAGEMENT_ROLES[number])) {
        throw new Error("You do not have permission to remove members");
      }

      // Check if actor can manage the target
      if (!canManage(actorRole, targetRole)) {
        throw new Error("You do not have permission to remove this member");
      }
    }

    // Check if removing an owner
    if (targetRole === "owner") {
      const ownerCount = await countOwners(ctx, organizationId);
      if (ownerCount <= 1) {
        throw new Error("Cannot remove the last owner of the organization");
      }
    }

    // Delete the membership
    await ctx.db.delete(memberId);

    return { success: true };
  },
});
