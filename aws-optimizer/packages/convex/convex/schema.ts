import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// Shared Validators
// ============================================================================

// Organization plan types
const planValidator = v.union(
  v.literal("free"),
  v.literal("starter"),
  v.literal("professional"),
  v.literal("enterprise")
);

// Organization member roles (within an organization)
const orgMemberRoleValidator = v.union(
  v.literal("owner"),   // Full access, billing, can delete org
  v.literal("admin"),   // Full access except billing/deletion
  v.literal("member"),  // Can view and create resources
  v.literal("viewer")   // Read-only access
);

// User roles (app-level, separate from org membership)
const userRoleValidator = v.union(
  v.literal("admin"),   // Platform admin (super user)
  v.literal("user")     // Regular user
);

// User account status
const userStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("pending")
);

// AWS account connection types
const awsConnectionTypeValidator = v.union(
  v.literal("iam_role"),   // Cross-account IAM role assumption
  v.literal("access_key"), // Direct access key credentials
  v.literal("sso")         // AWS SSO/Identity Center
);

// AWS account status
const awsAccountStatusValidator = v.union(
  v.literal("active"),   // Connected and working
  v.literal("inactive"), // Manually disabled
  v.literal("pending"),  // Awaiting setup/verification
  v.literal("error")     // Connection error
);

// Subscription status (Stripe compatible)
const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due"),
  v.literal("trialing"),
  v.literal("incomplete")
);

// Budget period types
const budgetPeriodValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly")
);

// Alert types
const alertTypeValidator = v.union(
  v.literal("budget_exceeded"),
  v.literal("anomaly_detected"),
  v.literal("recommendation_available"),
  v.literal("cost_spike"),
  v.literal("resource_idle")
);

// Alert severity levels
const alertSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("critical")
);

// Report types
const reportTypeValidator = v.union(
  v.literal("cost_analysis"),
  v.literal("savings_summary"),
  v.literal("resource_inventory"),
  v.literal("recommendation_summary"),
  v.literal("executive_summary")
);

// Report status
const reportStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed")
);

// Activity log action types
const activityActionValidator = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("delete")
);

// Activity log entity types
const activityEntityValidator = v.union(
  v.literal("organization"),
  v.literal("aws_account"),
  v.literal("budget"),
  v.literal("report")
);

export default defineSchema({
  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================
  // Organizations are the top-level multi-tenancy unit.
  // Each organization has its own AWS accounts, reports, and settings.
  organizations: defineTable({
    // Core identity
    name: v.string(),
    slug: v.string(), // URL-friendly unique identifier

    // Subscription/billing
    plan: planValidator,

    // Organization-level settings (flexible structure for org preferences)
    settings: v.object({
      enableNotifications: v.optional(v.boolean()),
      maxUsers: v.optional(v.number()),
      customDomain: v.optional(v.string()),
      defaultRegion: v.optional(v.string()),
      features: v.optional(v.object({})),
    }),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_plan", ["plan"]),

  // ============================================================================
  // ORGANIZATION MEMBERS
  // ============================================================================
  // Junction table linking users to organizations with roles.
  // A user can be a member of multiple organizations.
  // An organization can have multiple members.
  orgMembers: defineTable({
    // References
    organizationId: v.id("organizations"),
    userId: v.id("users"),

    // Role within this organization
    role: orgMemberRoleValidator,

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["organizationId", "userId"]),

  // ============================================================================
  // USERS
  // ============================================================================
  // User accounts compatible with Better Auth.
  // Users can belong to multiple organizations via orgMembers.
  users: defineTable({
    // Core identity (Better Auth compatible)
    email: v.string(),
    name: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()), // Avatar URL

    // App-level role (separate from org membership role)
    role: userRoleValidator,

    // Account status
    status: userStatusValidator,

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_role", ["role"]),

  // ============================================================================
  // AWS ACCOUNTS
  // ============================================================================
  // AWS accounts connected to an organization for cost analysis.
  awsAccounts: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Account identification
    name: v.string(),           // Friendly name (e.g., "Production", "Development")
    accountNumber: v.string(),  // 12-digit AWS account number

    // Connection configuration
    connectionType: awsConnectionTypeValidator,
    status: awsAccountStatusValidator,

    // Optional metadata
    description: v.optional(v.string()),
    region: v.optional(v.string()),      // Default region for this account
    lastVerifiedAt: v.optional(v.number()), // Last successful connection test

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_accountNumber", ["accountNumber"]),

  // ============================================================================
  // AWS CREDENTIALS
  // ============================================================================
  // Encrypted credentials for AWS account access.
  // Credentials are stored encrypted and decrypted only for sandbox injection.
  awsCredentials: defineTable({
    // AWS account reference
    awsAccountId: v.id("awsAccounts"),

    // Encrypted credential fields (for access_key connection type)
    encryptedAccessKeyId: v.optional(v.string()),
    encryptedSecretAccessKey: v.optional(v.string()),

    // IAM role configuration (for iam_role connection type)
    roleArn: v.optional(v.string()),        // ARN of the role to assume
    externalId: v.optional(v.string()),     // External ID for role assumption
    sessionDuration: v.optional(v.number()), // Session duration in seconds

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"]),

  // ============================================================================
  // SANDBOX EXECUTIONS
  // ============================================================================
  // Execution logs for AWS CLI commands run in the sandbox environment.
  sandboxExecutions: defineTable({
    // AWS account reference
    awsAccountId: v.id("awsAccounts"),

    // Command execution details
    command: v.string(),        // The AWS CLI command that was executed
    stdout: v.string(),         // Standard output from the command
    stderr: v.string(),         // Standard error from the command
    exitCode: v.number(),       // Exit code (0 = success)
    executionTime: v.number(),  // Execution time in milliseconds

    // Timestamp
    createdAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_awsAccount_createdAt", ["awsAccountId", "createdAt"]),

  // ============================================================================
  // ANALYSIS RUNS
  // ============================================================================
  // Tracks AI-driven analysis runs for an organization.
  analysisRuns: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Analysis configuration
    type: v.union(
      v.literal("full_analysis"),
      v.literal("cost_snapshot"),
      v.literal("resource_discovery"),
      v.literal("recommendation_refresh")
    ),

    // Run status
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  // ============================================================================
  // COST SNAPSHOTS
  // ============================================================================
  // Daily cost snapshots for AWS accounts, populated by AI agent.
  costSnapshots: defineTable({
    // AWS account reference
    awsAccountId: v.id("awsAccounts"),

    // Date of the snapshot (YYYY-MM-DD format)
    date: v.string(),

    // Total cost for this day
    totalCost: v.number(),

    // Breakdown by service (e.g., { "Amazon EC2": 500, "Amazon S3": 150 })
    serviceBreakdown: v.optional(v.record(v.string(), v.number())),

    // Breakdown by region (e.g., { "us-east-1": 800, "us-west-2": 300 })
    regionBreakdown: v.optional(v.record(v.string(), v.number())),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"])
    .index("by_date", ["date"])
    .index("by_awsAccount_date", ["awsAccountId", "date"]),

  // ============================================================================
  // RESOURCES
  // ============================================================================
  // AWS resources discovered by the AI agent.
  resources: defineTable({
    // AWS account reference
    awsAccountId: v.id("awsAccounts"),

    // Resource identification
    resourceType: v.string(),   // EC2, RDS, S3, Lambda, etc.
    resourceId: v.string(),     // AWS resource ID (e.g., i-1234567890abcdef0)
    name: v.optional(v.string()), // Resource name (from Name tag or similar)
    region: v.optional(v.string()), // AWS region

    // Resource tags (key-value pairs)
    tags: v.optional(v.record(v.string(), v.string())),

    // Cost estimate
    monthlyCost: v.optional(v.number()), // Estimated monthly cost

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"])
    .index("by_resourceType", ["resourceType"])
    .index("by_region", ["region"])
    .index("by_createdAt", ["createdAt"]),

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================
  // Cost optimization recommendations generated by the AI agent.
  recommendations: defineTable({
    // AWS account reference
    awsAccountId: v.id("awsAccounts"),

    // Recommendation details
    type: v.union(
      v.literal("rightsizing"),
      v.literal("reserved_instance"),
      v.literal("savings_plan"),
      v.literal("unused_resource"),
      v.literal("idle_resource"),
      v.literal("storage_optimization"),
      v.literal("network_optimization")
    ),
    title: v.string(),
    description: v.string(),

    // Savings estimate
    estimatedSavings: v.number(), // Monthly savings in dollars

    // Status tracking
    status: v.union(
      v.literal("open"),
      v.literal("implemented"),
      v.literal("dismissed"),
      v.literal("in_progress")
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_estimatedSavings", ["estimatedSavings"])
    .index("by_createdAt", ["createdAt"]),

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  // Stripe subscriptions linked to organizations.
  // Stripe component handles webhook signature verification.
  subscriptions: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Stripe identifiers
    stripeCustomerId: v.string(),
    planId: v.string(),

    // Subscription status
    status: subscriptionStatusValidator,

    // Billing period
    currentPeriodEnd: v.number(), // Unix timestamp

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // BUDGETS
  // ============================================================================
  // Cost budgets for organizations or specific AWS accounts.
  budgets: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Optional AWS account reference (if null, applies to entire org)
    awsAccountId: v.optional(v.id("awsAccounts")),

    // Budget configuration
    name: v.string(),
    amount: v.number(),           // Budget amount in dollars
    period: budgetPeriodValidator,

    // Alert thresholds (percentages, e.g., [50, 80, 100])
    alertThresholds: v.array(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_awsAccount", ["awsAccountId"]),

  // ============================================================================
  // ALERTS
  // ============================================================================
  // System alerts for budget thresholds, anomalies, and recommendations.
  alerts: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Alert details
    type: alertTypeValidator,
    title: v.string(),
    message: v.string(),
    severity: alertSeverityValidator,

    // Timing
    triggeredAt: v.number(),
    acknowledgedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_type", ["type"])
    .index("by_severity", ["severity"])
    .index("by_triggeredAt", ["triggeredAt"]),

  // ============================================================================
  // REPORTS
  // ============================================================================
  // Generated reports for cost analysis and recommendations.
  reports: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Report details
    type: reportTypeValidator,
    title: v.string(),
    status: reportStatusValidator,

    // File storage
    fileUrl: v.optional(v.string()), // URL to the generated report file

    // Timing
    generatedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_generatedAt", ["generatedAt"]),

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================
  // Tracks changes to entities for audit purposes.
  activityLogs: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // User who performed the action
    userId: v.id("users"),

    // Action details
    action: activityActionValidator,
    entityType: activityEntityValidator,
    entityId: v.string(), // ID of the entity that was changed

    // Change details (optional metadata about what changed)
    details: v.optional(v.object({
      previousValues: v.optional(v.any()),
      newValues: v.optional(v.any()),
      description: v.optional(v.string()),
    })),

    // Timestamp
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_entityType", ["entityType"])
    .index("by_createdAt", ["createdAt"]),
});
