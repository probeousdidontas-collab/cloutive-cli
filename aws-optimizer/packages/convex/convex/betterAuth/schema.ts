import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const tables = {
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.union(v.null(), v.string())),
    role: v.optional(v.union(v.null(), v.string())),
    banned: v.optional(v.union(v.null(), v.boolean())),
    banReason: v.optional(v.union(v.null(), v.string())),
    banExpires: v.optional(v.union(v.null(), v.number())),
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"]),
  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    userAgent: v.optional(v.union(v.null(), v.string())),
    userId: v.string(),
    impersonatedBy: v.optional(v.union(v.null(), v.string())),
    activeOrganizationId: v.optional(v.union(v.null(), v.string())),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),
  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    idToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),
  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),
  jwks: defineTable({
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
  }),

  // ============================================================================
  // Organization Plugin Tables
  // ============================================================================

  // Organizations table - stores organization entities
  organization: defineTable({
    name: v.string(),
    slug: v.optional(v.union(v.null(), v.string())),
    logo: v.optional(v.union(v.null(), v.string())),
    metadata: v.optional(v.union(v.null(), v.string())), // JSON string for additional data
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // Optional on creation, set on updates
  })
    .index("slug", ["slug"])
    .index("name", ["name"]),

  // Members table - links users to organizations with roles
  member: defineTable({
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(), // owner, admin, member, or custom roles
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // Optional on creation, set on updates
  })
    .index("organizationId", ["organizationId"])
    .index("userId", ["userId"])
    .index("organizationId_userId", ["organizationId", "userId"]),

  // Invitations table - pending invitations to join organizations
  invitation: defineTable({
    organizationId: v.string(),
    email: v.string(),
    role: v.string(),
    status: v.string(), // pending, accepted, canceled, expired
    inviterId: v.string(), // User who sent the invitation
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // Optional on creation, set on updates
  })
    .index("organizationId", ["organizationId"])
    .index("email", ["email"])
    .index("organizationId_email", ["organizationId", "email"])
    .index("status", ["status"]),
};

const schema = defineSchema(tables);

export default schema;
