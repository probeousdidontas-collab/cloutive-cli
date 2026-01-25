import { convexTest } from "convex-test";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// AWS Integration Types
// ============================================================================

// AWS account connection types
export type AwsConnectionType = "iam_role" | "access_key" | "sso";

// AWS account status
export type AwsAccountStatus = "active" | "inactive" | "pending" | "error";

// Organization plan types
export type OrganizationPlan = "free" | "starter" | "professional" | "enterprise";

// Organization member roles
export type OrgMemberRole = "owner" | "admin" | "member" | "viewer";

// User roles (app-level)
export type UserRole = "admin" | "user";

// User status
export type UserStatus = "active" | "inactive" | "pending";

// Mock organization data structure
export interface MockOrganization {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// Mock org member data structure
export interface MockOrgMember {
  _id: Id<"orgMembers">;
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  role: OrgMemberRole;
  createdAt: number;
  updatedAt: number;
}

// Mock user data structure
export interface MockUser {
  _id: Id<"users">;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock organization
export interface CreateMockOrganizationOptions {
  name?: string;
  slug?: string;
  plan?: OrganizationPlan;
  settings?: Record<string, unknown>;
}

/**
 * Create a mock organization in the test database.
 */
export async function createMockOrganization(
  t: ReturnType<typeof convexTest>,
  options: CreateMockOrganizationOptions = {}
): Promise<MockOrganization> {
  const now = Date.now();
  const name = options.name ?? `Test Organization ${now}`;
  const slug = options.slug ?? name.toLowerCase().replace(/\s+/g, "-");
  const plan = options.plan ?? "free";
  const settings = options.settings ?? {};

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name,
      slug,
      plan,
      settings,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: orgId as Id<"organizations">,
    name,
    slug,
    plan,
    settings,
    createdAt: now,
    updatedAt: now,
  };
}

// Options for creating a mock user
export interface CreateMockUserOptions {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  image?: string;
}

/**
 * Create a mock user in the test database.
 */
export async function createMockUser(
  t: ReturnType<typeof convexTest>,
  options: CreateMockUserOptions = {}
): Promise<MockUser> {
  const now = Date.now();
  const email = options.email ?? `user-${now}@example.com`;
  const name = options.name ?? "Test User";
  const role = options.role ?? "user";
  const status = options.status ?? "active";
  const emailVerified = options.emailVerified ?? true;

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email,
      name,
      role,
      status,
      emailVerified,
      image: options.image,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: userId as Id<"users">,
    email,
    name,
    role,
    status,
    emailVerified,
    createdAt: now,
    updatedAt: now,
  };
}

// Options for creating a mock org member
export interface CreateMockOrgMemberOptions {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  role?: OrgMemberRole;
}

/**
 * Create a mock organization member in the test database.
 */
export async function createMockOrgMember(
  t: ReturnType<typeof convexTest>,
  options: CreateMockOrgMemberOptions
): Promise<MockOrgMember> {
  const now = Date.now();
  const role = options.role ?? "member";

  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert("orgMembers", {
      organizationId: options.organizationId,
      userId: options.userId,
      role,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: memberId as Id<"orgMembers">,
    organizationId: options.organizationId,
    userId: options.userId,
    role,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create an admin user in the test database.
 */
export async function createAdminUser(
  t: ReturnType<typeof convexTest>,
  options: Omit<CreateMockUserOptions, "role"> = {}
): Promise<MockUser> {
  return createMockUser(t, { ...options, role: "admin" });
}

/**
 * Create an organization with an owner member.
 */
export async function createOrganizationWithOwner(
  t: ReturnType<typeof convexTest>,
  orgOptions: CreateMockOrganizationOptions = {},
  userOptions: CreateMockUserOptions = {}
): Promise<{ organization: MockOrganization; owner: MockUser; membership: MockOrgMember }> {
  const organization = await createMockOrganization(t, orgOptions);
  const owner = await createMockUser(t, userOptions);
  const membership = await createMockOrgMember(t, {
    organizationId: organization._id,
    userId: owner._id,
    role: "owner",
  });

  return { organization, owner, membership };
}

// ============================================================================
// AWS INTEGRATION HELPERS
// ============================================================================

// Mock AWS account data structure
export interface MockAwsAccount {
  _id: Id<"awsAccounts">;
  organizationId: Id<"organizations">;
  name: string;
  accountNumber: string;
  connectionType: AwsConnectionType;
  status: AwsAccountStatus;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock AWS account
export interface CreateMockAwsAccountOptions {
  organizationId: Id<"organizations">;
  name?: string;
  accountNumber?: string;
  connectionType?: AwsConnectionType;
  status?: AwsAccountStatus;
}

/**
 * Create a mock AWS account in the test database.
 */
export async function createMockAwsAccount(
  t: ReturnType<typeof convexTest>,
  options: CreateMockAwsAccountOptions
): Promise<MockAwsAccount> {
  const now = Date.now();
  const name = options.name ?? `Test AWS Account ${now}`;
  const accountNumber = options.accountNumber ?? `${Math.floor(Math.random() * 900000000000) + 100000000000}`;
  const connectionType = options.connectionType ?? "iam_role";
  const status = options.status ?? "active";

  const awsAccountId = await t.run(async (ctx) => {
    return await ctx.db.insert("awsAccounts", {
      organizationId: options.organizationId,
      name,
      accountNumber,
      connectionType,
      status,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: awsAccountId as Id<"awsAccounts">,
    organizationId: options.organizationId,
    name,
    accountNumber,
    connectionType,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock AWS credentials data structure
export interface MockAwsCredentials {
  _id: Id<"awsCredentials">;
  awsAccountId: Id<"awsAccounts">;
  encryptedAccessKeyId?: string;
  encryptedSecretAccessKey?: string;
  roleArn?: string;
  externalId?: string;
  sessionDuration?: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating mock AWS credentials
export interface CreateMockAwsCredentialsOptions {
  awsAccountId: Id<"awsAccounts">;
  encryptedAccessKeyId?: string;
  encryptedSecretAccessKey?: string;
  roleArn?: string;
  externalId?: string;
  sessionDuration?: number;
}

/**
 * Create mock AWS credentials in the test database.
 */
export async function createMockAwsCredentials(
  t: ReturnType<typeof convexTest>,
  options: CreateMockAwsCredentialsOptions
): Promise<MockAwsCredentials> {
  const now = Date.now();

  const credentialsId = await t.run(async (ctx) => {
    return await ctx.db.insert("awsCredentials", {
      awsAccountId: options.awsAccountId,
      encryptedAccessKeyId: options.encryptedAccessKeyId,
      encryptedSecretAccessKey: options.encryptedSecretAccessKey,
      roleArn: options.roleArn,
      externalId: options.externalId,
      sessionDuration: options.sessionDuration,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: credentialsId as Id<"awsCredentials">,
    awsAccountId: options.awsAccountId,
    encryptedAccessKeyId: options.encryptedAccessKeyId,
    encryptedSecretAccessKey: options.encryptedSecretAccessKey,
    roleArn: options.roleArn,
    externalId: options.externalId,
    sessionDuration: options.sessionDuration,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock sandbox execution data structure
export interface MockSandboxExecution {
  _id: Id<"sandboxExecutions">;
  awsAccountId: Id<"awsAccounts">;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  createdAt: number;
}

// Options for creating a mock sandbox execution
export interface CreateMockSandboxExecutionOptions {
  awsAccountId: Id<"awsAccounts">;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionTime?: number;
}

/**
 * Create a mock sandbox execution in the test database.
 */
export async function createMockSandboxExecution(
  t: ReturnType<typeof convexTest>,
  options: CreateMockSandboxExecutionOptions
): Promise<MockSandboxExecution> {
  const now = Date.now();
  const command = options.command ?? "aws sts get-caller-identity";
  const stdout = options.stdout ?? '{"Account": "123456789012"}';
  const stderr = options.stderr ?? "";
  const exitCode = options.exitCode ?? 0;
  const executionTime = options.executionTime ?? 500;

  const executionId = await t.run(async (ctx) => {
    return await ctx.db.insert("sandboxExecutions", {
      awsAccountId: options.awsAccountId,
      command,
      stdout,
      stderr,
      exitCode,
      executionTime,
      createdAt: now,
    });
  });

  return {
    _id: executionId as Id<"sandboxExecutions">,
    awsAccountId: options.awsAccountId,
    command,
    stdout,
    stderr,
    exitCode,
    executionTime,
    createdAt: now,
  };
}

// ============================================================================
// AI AND ANALYSIS HELPERS
// ============================================================================

// Analysis run types
export type AnalysisRunType = "full_analysis" | "cost_snapshot" | "resource_discovery" | "recommendation_refresh";

// Analysis run status
export type AnalysisRunStatus = "pending" | "running" | "completed" | "failed";

// Recommendation types
export type RecommendationType = 
  | "rightsizing"
  | "reserved_instance"
  | "savings_plan"
  | "unused_resource"
  | "idle_resource"
  | "storage_optimization"
  | "network_optimization";

// Recommendation status
export type RecommendationStatus = "open" | "implemented" | "dismissed" | "in_progress";

// Subscription status (Stripe compatible)
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | "incomplete";

// Budget period types
export type BudgetPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

// Alert types
export type AlertType = "budget_exceeded" | "anomaly_detected" | "recommendation_available" | "cost_spike" | "resource_idle";

// Alert severity levels
export type AlertSeverity = "info" | "warning" | "critical";

// Report types
export type ReportType = "cost_analysis" | "savings_summary" | "resource_inventory" | "recommendation_summary" | "executive_summary";

// Report status
export type ReportStatus = "pending" | "generating" | "completed" | "failed";

// Mock analysis run data structure
export interface MockAnalysisRun {
  _id: Id<"analysisRuns">;
  organizationId: Id<"organizations">;
  type: AnalysisRunType;
  status: AnalysisRunStatus;
  startedAt: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock analysis run
export interface CreateMockAnalysisRunOptions {
  organizationId: Id<"organizations">;
  type?: AnalysisRunType;
  status?: AnalysisRunStatus;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Create a mock analysis run in the test database.
 */
export async function createMockAnalysisRun(
  t: ReturnType<typeof convexTest>,
  options: CreateMockAnalysisRunOptions
): Promise<MockAnalysisRun> {
  const now = Date.now();
  const type = options.type ?? "full_analysis";
  const status = options.status ?? "pending";
  const startedAt = options.startedAt ?? now;

  const runId = await t.run(async (ctx) => {
    return await ctx.db.insert("analysisRuns", {
      organizationId: options.organizationId,
      type,
      status,
      startedAt,
      completedAt: options.completedAt,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: runId as Id<"analysisRuns">,
    organizationId: options.organizationId,
    type,
    status,
    startedAt,
    completedAt: options.completedAt,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock cost snapshot data structure
export interface MockCostSnapshot {
  _id: Id<"costSnapshots">;
  awsAccountId: Id<"awsAccounts">;
  date: string;
  totalCost: number;
  serviceBreakdown?: Record<string, number>;
  regionBreakdown?: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock cost snapshot
export interface CreateMockCostSnapshotOptions {
  awsAccountId: Id<"awsAccounts">;
  date?: string;
  totalCost?: number;
  serviceBreakdown?: Record<string, number>;
  regionBreakdown?: Record<string, number>;
}

/**
 * Create a mock cost snapshot in the test database.
 */
export async function createMockCostSnapshot(
  t: ReturnType<typeof convexTest>,
  options: CreateMockCostSnapshotOptions
): Promise<MockCostSnapshot> {
  const now = Date.now();
  const date = options.date ?? new Date().toISOString().split("T")[0];
  const totalCost = options.totalCost ?? 0;

  const snapshotId = await t.run(async (ctx) => {
    return await ctx.db.insert("costSnapshots", {
      awsAccountId: options.awsAccountId,
      date,
      totalCost,
      serviceBreakdown: options.serviceBreakdown,
      regionBreakdown: options.regionBreakdown,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: snapshotId as Id<"costSnapshots">,
    awsAccountId: options.awsAccountId,
    date,
    totalCost,
    serviceBreakdown: options.serviceBreakdown,
    regionBreakdown: options.regionBreakdown,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock resource data structure
export interface MockResource {
  _id: Id<"resources">;
  awsAccountId: Id<"awsAccounts">;
  resourceType: string;
  resourceId: string;
  name?: string;
  region?: string;
  tags?: Record<string, string>;
  monthlyCost?: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock resource
export interface CreateMockResourceOptions {
  awsAccountId: Id<"awsAccounts">;
  resourceType: string;
  resourceId: string;
  name?: string;
  region?: string;
  tags?: Record<string, string>;
  monthlyCost?: number;
}

/**
 * Create a mock resource in the test database.
 */
export async function createMockResource(
  t: ReturnType<typeof convexTest>,
  options: CreateMockResourceOptions
): Promise<MockResource> {
  const now = Date.now();

  const resourceDbId = await t.run(async (ctx) => {
    return await ctx.db.insert("resources", {
      awsAccountId: options.awsAccountId,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      name: options.name,
      region: options.region,
      tags: options.tags,
      monthlyCost: options.monthlyCost,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: resourceDbId as Id<"resources">,
    awsAccountId: options.awsAccountId,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    name: options.name,
    region: options.region,
    tags: options.tags,
    monthlyCost: options.monthlyCost,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock recommendation data structure
export interface MockRecommendation {
  _id: Id<"recommendations">;
  awsAccountId: Id<"awsAccounts">;
  type: RecommendationType;
  title: string;
  description: string;
  estimatedSavings: number;
  status: RecommendationStatus;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock recommendation
export interface CreateMockRecommendationOptions {
  awsAccountId: Id<"awsAccounts">;
  type?: RecommendationType;
  title?: string;
  description?: string;
  estimatedSavings?: number;
  status?: RecommendationStatus;
}

/**
 * Create a mock recommendation in the test database.
 */
export async function createMockRecommendation(
  t: ReturnType<typeof convexTest>,
  options: CreateMockRecommendationOptions
): Promise<MockRecommendation> {
  const now = Date.now();
  const type = options.type ?? "rightsizing";
  const title = options.title ?? "Test Recommendation";
  const description = options.description ?? "This is a test recommendation.";
  const estimatedSavings = options.estimatedSavings ?? 100;
  const status = options.status ?? "open";

  const recommendationId = await t.run(async (ctx) => {
    return await ctx.db.insert("recommendations", {
      awsAccountId: options.awsAccountId,
      type,
      title,
      description,
      estimatedSavings,
      status,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: recommendationId as Id<"recommendations">,
    awsAccountId: options.awsAccountId,
    type,
    title,
    description,
    estimatedSavings,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// BILLING AND FEATURE HELPERS
// ============================================================================

// Mock subscription data structure
export interface MockSubscription {
  _id: Id<"subscriptions">;
  organizationId: Id<"organizations">;
  stripeCustomerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock subscription
export interface CreateMockSubscriptionOptions {
  organizationId: Id<"organizations">;
  stripeCustomerId?: string;
  planId?: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: number;
}

/**
 * Create a mock subscription in the test database.
 */
export async function createMockSubscription(
  t: ReturnType<typeof convexTest>,
  options: CreateMockSubscriptionOptions
): Promise<MockSubscription> {
  const now = Date.now();
  const stripeCustomerId = options.stripeCustomerId ?? `cus_${now}`;
  const planId = options.planId ?? "plan_free";
  const status = options.status ?? "active";
  const currentPeriodEnd = options.currentPeriodEnd ?? now + 30 * 24 * 60 * 60 * 1000;

  const subscriptionId = await t.run(async (ctx) => {
    return await ctx.db.insert("subscriptions", {
      organizationId: options.organizationId,
      stripeCustomerId,
      planId,
      status,
      currentPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: subscriptionId as Id<"subscriptions">,
    organizationId: options.organizationId,
    stripeCustomerId,
    planId,
    status,
    currentPeriodEnd,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock budget data structure
export interface MockBudget {
  _id: Id<"budgets">;
  organizationId: Id<"organizations">;
  awsAccountId?: Id<"awsAccounts">;
  name: string;
  amount: number;
  period: BudgetPeriod;
  alertThresholds: number[];
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock budget
export interface CreateMockBudgetOptions {
  organizationId: Id<"organizations">;
  awsAccountId?: Id<"awsAccounts">;
  name?: string;
  amount?: number;
  period?: BudgetPeriod;
  alertThresholds?: number[];
}

/**
 * Create a mock budget in the test database.
 */
export async function createMockBudget(
  t: ReturnType<typeof convexTest>,
  options: CreateMockBudgetOptions
): Promise<MockBudget> {
  const now = Date.now();
  const name = options.name ?? `Budget ${now}`;
  const amount = options.amount ?? 1000;
  const period = options.period ?? "monthly";
  const alertThresholds = options.alertThresholds ?? [50, 80, 100];

  const budgetId = await t.run(async (ctx) => {
    return await ctx.db.insert("budgets", {
      organizationId: options.organizationId,
      awsAccountId: options.awsAccountId,
      name,
      amount,
      period,
      alertThresholds,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: budgetId as Id<"budgets">,
    organizationId: options.organizationId,
    awsAccountId: options.awsAccountId,
    name,
    amount,
    period,
    alertThresholds,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock alert data structure
export interface MockAlert {
  _id: Id<"alerts">;
  organizationId: Id<"organizations">;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  triggeredAt: number;
  acknowledgedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock alert
export interface CreateMockAlertOptions {
  organizationId: Id<"organizations">;
  type?: AlertType;
  title?: string;
  message?: string;
  severity?: AlertSeverity;
  triggeredAt?: number;
  acknowledgedAt?: number;
}

/**
 * Create a mock alert in the test database.
 */
export async function createMockAlert(
  t: ReturnType<typeof convexTest>,
  options: CreateMockAlertOptions
): Promise<MockAlert> {
  const now = Date.now();
  const type = options.type ?? "budget_exceeded";
  const title = options.title ?? "Test Alert";
  const message = options.message ?? "This is a test alert message.";
  const severity = options.severity ?? "warning";
  const triggeredAt = options.triggeredAt ?? now;

  const alertId = await t.run(async (ctx) => {
    return await ctx.db.insert("alerts", {
      organizationId: options.organizationId,
      type,
      title,
      message,
      severity,
      triggeredAt,
      acknowledgedAt: options.acknowledgedAt,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: alertId as Id<"alerts">,
    organizationId: options.organizationId,
    type,
    title,
    message,
    severity,
    triggeredAt,
    acknowledgedAt: options.acknowledgedAt,
    createdAt: now,
    updatedAt: now,
  };
}

// Mock report data structure
export interface MockReport {
  _id: Id<"reports">;
  organizationId: Id<"organizations">;
  type: ReportType;
  title: string;
  status: ReportStatus;
  fileUrl?: string;
  generatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Options for creating a mock report
export interface CreateMockReportOptions {
  organizationId: Id<"organizations">;
  type?: ReportType;
  title?: string;
  status?: ReportStatus;
  fileUrl?: string;
  generatedAt?: number;
}

/**
 * Create a mock report in the test database.
 */
export async function createMockReport(
  t: ReturnType<typeof convexTest>,
  options: CreateMockReportOptions
): Promise<MockReport> {
  const now = Date.now();
  const type = options.type ?? "cost_analysis";
  const title = options.title ?? `Report ${now}`;
  const status = options.status ?? "pending";
  const generatedAt = options.generatedAt ?? (status === "completed" ? now : undefined);

  const reportId = await t.run(async (ctx) => {
    return await ctx.db.insert("reports", {
      organizationId: options.organizationId,
      type,
      title,
      status,
      fileUrl: options.fileUrl,
      generatedAt,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    _id: reportId as Id<"reports">,
    organizationId: options.organizationId,
    type,
    title,
    status,
    fileUrl: options.fileUrl,
    generatedAt,
    createdAt: now,
    updatedAt: now,
  };
}
