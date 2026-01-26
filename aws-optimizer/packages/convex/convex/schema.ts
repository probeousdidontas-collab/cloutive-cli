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
  v.literal("iam_role"),        // Cross-account IAM role assumption
  v.literal("access_key"),      // Direct access key credentials
  v.literal("credentials_file"), // Uploaded credentials file
  v.literal("sso"),             // AWS SSO/Identity Center
  v.literal("oidc")             // OIDC/Web Identity federation
);

// Credential validation status
const credentialValidationStatusValidator = v.union(
  v.literal("healthy"),   // Credentials are valid and working
  v.literal("expiring"),  // Credentials will expire soon (within 7 days)
  v.literal("expired"),   // Credentials have expired
  v.literal("invalid"),   // Credentials failed validation
  v.literal("unknown")    // Not yet validated
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
  v.literal("report"),
  v.literal("invitation")
);

// AWS Organizations discovery status
const orgDiscoveryStatusValidator = v.union(
  v.literal("pending"),     // Discovery initiated
  v.literal("discovering"), // Fetching accounts from AWS
  v.literal("discovered"),  // Accounts discovered, awaiting approval
  v.literal("deploying"),   // Deploying IAM roles via StackSets
  v.literal("completed"),   // All selected accounts connected
  v.literal("failed")       // Discovery or deployment failed
);

// Discovered account status
const discoveredAccountStatusValidator = v.union(
  v.literal("discovered"),  // Found but not yet processed
  v.literal("selected"),    // Selected for connection
  v.literal("connecting"),  // IAM role being deployed
  v.literal("connected"),   // Successfully connected
  v.literal("skipped"),     // User chose to skip
  v.literal("failed")       // Connection failed
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

    // Better Auth integration - maps Better Auth org ID to Convex org
    betterAuthOrgId: v.optional(v.string()),

    // Subscription/billing
    plan: planValidator,

    // Organization-level settings (flexible structure for org preferences)
    settings: v.object({
      enableNotifications: v.optional(v.boolean()),
      maxUsers: v.optional(v.number()),
      customDomain: v.optional(v.string()),
      defaultRegion: v.optional(v.string()),
      features: v.optional(v.object({})),
      // Notification preferences for email summaries (US-037)
      notificationPreferences: v.optional(v.object({
        emailFrequency: v.optional(v.string()), // "realtime", "daily", "weekly", "never"
        alertTypes: v.optional(v.array(v.string())), // Which alert types to receive
      })),
    }),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_plan", ["plan"])
    .index("by_betterAuthOrgId", ["betterAuthOrgId"]),

  // ============================================================================
  // ORGANIZATION INVITATIONS
  // ============================================================================
  // Pending invitations to join an organization.
  // Used for partner-created client organizations where client becomes owner.
  orgInvitations: defineTable({
    // Organization reference
    organizationId: v.id("organizations"),

    // Invitee details
    email: v.string(), // Email of the invited user
    role: orgMemberRoleValidator, // Role they will have when accepting

    // Invitation status
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("cancelled")
    ),

    // Who sent the invitation
    invitedBy: v.id("users"),

    // Timestamps
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

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

    // Encrypted credential fields (for access_key and credentials_file connection types)
    encryptedAccessKeyId: v.optional(v.string()),
    encryptedSecretAccessKey: v.optional(v.string()),
    encryptedSessionToken: v.optional(v.string()), // For temporary credentials

    // IAM role configuration (for iam_role connection type)
    roleArn: v.optional(v.string()),        // ARN of the role to assume
    externalId: v.optional(v.string()),     // External ID for role assumption
    sessionDuration: v.optional(v.number()), // Session duration in seconds

    // SSO configuration (for sso connection type)
    ssoStartUrl: v.optional(v.string()),    // AWS SSO start URL
    ssoRegion: v.optional(v.string()),      // AWS SSO region
    ssoAccountId: v.optional(v.string()),   // Target account ID for SSO
    ssoRoleName: v.optional(v.string()),    // SSO role name to assume

    // OIDC configuration (for oidc connection type)
    oidcProviderArn: v.optional(v.string()), // ARN of the OIDC identity provider
    oidcRoleArn: v.optional(v.string()),     // ARN of the role to assume via OIDC
    oidcAudience: v.optional(v.string()),    // OIDC audience/client ID

    // Credential source tracking (for credentials_file)
    sourceProfile: v.optional(v.string()),   // Profile name from credentials file
    sourceFormat: v.optional(v.string()),    // Format: ini, json, env

    // Expiry and validation tracking
    expiresAt: v.optional(v.number()),       // When credentials expire (timestamp)
    lastValidatedAt: v.optional(v.number()), // Last successful validation
    validationStatus: v.optional(credentialValidationStatusValidator),
    validationMessage: v.optional(v.string()), // Last validation error/success message
    verifiedAccountNumber: v.optional(v.string()), // AWS account number verified via sts:GetCallerIdentity

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_awsAccount", ["awsAccountId"])
    .index("by_validationStatus", ["validationStatus"])
    .index("by_expiresAt", ["expiresAt"]),

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

    // Optional AWS account reference (for account-specific runs)
    awsAccountId: v.optional(v.id("awsAccounts")),

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
    .index("by_awsAccount", ["awsAccountId"])
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
  // USAGE RECORDS
  // ============================================================================
  // Tracks usage for billing purposes (AI analysis runs, etc.).
  usageRecords: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Usage type
    type: v.union(
      v.literal("analysis_run"),
      v.literal("api_call")
    ),

    // Quantity of usage
    quantity: v.number(),

    // Billing period
    billingPeriodStart: v.number(),
    billingPeriodEnd: v.number(),

    // Timestamp
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),

  // ============================================================================
  // AWS ORGANIZATIONS DISCOVERY
  // ============================================================================
  // Tracks AWS Organizations discovery sessions for importing member accounts.
  awsOrgDiscoveries: defineTable({
    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // Management account used for discovery
    managementAwsAccountId: v.optional(v.id("awsAccounts")), // If using existing account
    managementAccountNumber: v.string(), // 12-digit AWS account number

    // Discovery status
    status: orgDiscoveryStatusValidator,
    statusMessage: v.optional(v.string()),

    // Discovery results
    totalAccountsFound: v.optional(v.number()),
    accountsSelected: v.optional(v.number()),
    accountsConnected: v.optional(v.number()),

    // StackSet deployment tracking
    stackSetName: v.optional(v.string()),
    stackSetOperationId: v.optional(v.string()),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_managementAccount", ["managementAccountNumber"]),

  // ============================================================================
  // DISCOVERED AWS ACCOUNTS
  // ============================================================================
  // Member accounts discovered from AWS Organizations.
  discoveredAwsAccounts: defineTable({
    // Discovery session reference
    discoveryId: v.id("awsOrgDiscoveries"),

    // Organization reference (multi-tenancy)
    organizationId: v.id("organizations"),

    // AWS account details from organizations:ListAccounts
    accountNumber: v.string(),   // 12-digit AWS account number
    accountName: v.string(),     // Account name from AWS
    email: v.string(),           // Root email of the account
    accountArn: v.string(),      // Full ARN of the account
    joinedMethod: v.string(),    // "INVITED" or "CREATED"
    joinedTimestamp: v.number(), // When account joined the org
    awsStatus: v.string(),       // "ACTIVE", "SUSPENDED", etc.

    // Processing status
    status: discoveredAccountStatusValidator,
    statusMessage: v.optional(v.string()),

    // If connected, reference to the AWS account
    connectedAwsAccountId: v.optional(v.id("awsAccounts")),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_discovery", ["discoveryId"])
    .index("by_organization", ["organizationId"])
    .index("by_accountNumber", ["accountNumber"])
    .index("by_status", ["status"])
    .index("by_discovery_status", ["discoveryId", "status"]),

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
