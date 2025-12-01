# AWS IAM Permissions Requirements for Complete Infrastructure Analysis

This document outlines the IAM permissions required for a comprehensive AWS infrastructure analysis and audit. These permissions are **read-only** and designed following the **principle of least privilege**.

---

## Quick Start: AWS Managed Policies

For a quick setup, you can use these AWS managed policies:

| Policy Name | ARN | Purpose |
|-------------|-----|--------|
| **ReadOnlyAccess** | `arn:aws:iam::aws:policy/ReadOnlyAccess` | Full read access to all AWS services |
| **SecurityAudit** | `arn:aws:iam::aws:policy/SecurityAudit` | Security-focused read access |
| **ViewOnlyAccess** | `arn:aws:iam::aws:policy/job-function/ViewOnlyAccess` | Console view access |

**Recommended:** Use `ReadOnlyAccess` + `SecurityAudit` for complete analysis.

---

## Custom IAM Policy (Least Privilege)

For more restrictive access, use this custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AccountAndOrganization",
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "iam:GetAccountSummary",
        "iam:GetAccountPasswordPolicy",
        "iam:ListAccountAliases",
        "organizations:DescribeOrganization",
        "organizations:ListAccounts",
        "organizations:ListOrganizationalUnitsForParent",
        "organizations:ListRoots",
        "organizations:DescribeAccount"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMReadAccess",
      "Effect": "Allow",
      "Action": [
        "iam:GetUser",
        "iam:ListUsers",
        "iam:GetLoginProfile",
        "iam:ListMFADevices",
        "iam:ListAccessKeys",
        "iam:GetAccessKeyLastUsed",
        "iam:ListUserPolicies",
        "iam:ListAttachedUserPolicies",
        "iam:ListGroupsForUser",
        "iam:GetRole",
        "iam:ListRoles",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:GetRolePolicy",
        "iam:GetGroup",
        "iam:ListGroups",
        "iam:ListGroupPolicies",
        "iam:ListAttachedGroupPolicies",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicies",
        "iam:ListEntitiesForPolicy",
        "iam:GenerateCredentialReport",
        "iam:GetCredentialReport",
        "iam:GetServiceLastAccessedDetails",
        "iam:GenerateServiceLastAccessedDetails",
        "iam:ListVirtualMFADevices",
        "iam:GetAccountAuthorizationDetails"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EC2ReadAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeInstanceTypes",
        "ec2:DescribeImages",
        "ec2:DescribeVolumes",
        "ec2:DescribeVolumeStatus",
        "ec2:DescribeSnapshots",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSecurityGroupRules",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeRouteTables",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeNatGateways",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeAddresses",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeLaunchTemplates",
        "ec2:DescribeLaunchTemplateVersions",
        "ec2:DescribeFlowLogs",
        "ec2:DescribeVpcEndpoints",
        "ec2:DescribeVpcPeeringConnections",
        "ec2:DescribeTransitGateways",
        "ec2:DescribeTransitGatewayAttachments",
        "ec2:DescribeTags",
        "ec2:DescribeRegions",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeReservedInstances",
        "ec2:DescribeSpotInstanceRequests"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:ListClusters",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "ecs:ListTaskDefinitions",
        "ecs:DescribeTaskDefinition",
        "ecs:ListContainerInstances",
        "ecs:DescribeContainerInstances",
        "ecs:DescribeCapacityProviders",
        "ecs:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EKSReadAccess",
      "Effect": "Allow",
      "Action": [
        "eks:ListClusters",
        "eks:DescribeCluster",
        "eks:ListNodegroups",
        "eks:DescribeNodegroup",
        "eks:ListFargateProfiles",
        "eks:DescribeFargateProfile"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LambdaReadAccess",
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:ListVersionsByFunction",
        "lambda:ListAliases",
        "lambda:GetPolicy",
        "lambda:ListEventSourceMappings",
        "lambda:ListTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSReadAccess",
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters",
        "rds:DescribeDBSnapshots",
        "rds:DescribeDBClusterSnapshots",
        "rds:DescribeDBSubnetGroups",
        "rds:DescribeDBParameterGroups",
        "rds:DescribeDBClusterParameterGroups",
        "rds:DescribeDBSecurityGroups",
        "rds:DescribeDBEngineVersions",
        "rds:DescribeReservedDBInstances",
        "rds:DescribeEventSubscriptions",
        "rds:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBReadAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:ListBackups",
        "dynamodb:DescribeBackup",
        "dynamodb:ListGlobalTables",
        "dynamodb:DescribeGlobalTable",
        "dynamodb:ListTagsOfResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ElastiCacheReadAccess",
      "Effect": "Allow",
      "Action": [
        "elasticache:DescribeCacheClusters",
        "elasticache:DescribeReplicationGroups",
        "elasticache:DescribeCacheSubnetGroups",
        "elasticache:DescribeCacheParameterGroups",
        "elasticache:DescribeSnapshots",
        "elasticache:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3ReadAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:GetBucketEncryption",
        "s3:GetBucketLogging",
        "s3:GetBucketPolicy",
        "s3:GetBucketPolicyStatus",
        "s3:GetBucketPublicAccessBlock",
        "s3:GetAccountPublicAccessBlock",
        "s3:GetBucketAcl",
        "s3:GetBucketCORS",
        "s3:GetBucketLifecycleConfiguration",
        "s3:GetBucketReplication",
        "s3:GetBucketTagging",
        "s3:GetBucketWebsite",
        "s3:GetBucketNotification",
        "s3:GetBucketObjectLockConfiguration",
        "s3:GetIntelligentTieringConfiguration",
        "s3:ListBucketVersions",
        "s3:GetMetricsConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EBSReadAccess",
      "Effect": "Allow",
      "Action": [
        "ebs:ListSnapshotBlocks",
        "ebs:ListChangedBlocks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EFSReadAccess",
      "Effect": "Allow",
      "Action": [
        "elasticfilesystem:DescribeFileSystems",
        "elasticfilesystem:DescribeMountTargets",
        "elasticfilesystem:DescribeMountTargetSecurityGroups",
        "elasticfilesystem:DescribeAccessPoints",
        "elasticfilesystem:DescribeBackupPolicy",
        "elasticfilesystem:DescribeLifecycleConfiguration",
        "elasticfilesystem:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LoadBalancerReadAccess",
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:DescribeListenerCertificates",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:DescribeTags",
        "elasticloadbalancing:DescribeSSLPolicies"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AutoScalingReadAccess",
      "Effect": "Allow",
      "Action": [
        "autoscaling:DescribeAutoScalingGroups",
        "autoscaling:DescribeAutoScalingInstances",
        "autoscaling:DescribeLaunchConfigurations",
        "autoscaling:DescribePolicies",
        "autoscaling:DescribeScalingActivities",
        "autoscaling:DescribeScheduledActions",
        "autoscaling:DescribeTags",
        "autoscaling:DescribeLifecycleHooks",
        "application-autoscaling:DescribeScalableTargets",
        "application-autoscaling:DescribeScalingPolicies"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Route53ReadAccess",
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListHealthChecks",
        "route53:GetHealthCheck",
        "route53:ListTrafficPolicies",
        "route53:ListTagsForResource",
        "route53domains:ListDomains",
        "route53domains:GetDomainDetail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFrontReadAccess",
      "Effect": "Allow",
      "Action": [
        "cloudfront:ListDistributions",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:ListOriginAccessControls",
        "cloudfront:ListFunctions",
        "cloudfront:ListCachePolicies",
        "cloudfront:ListOriginRequestPolicies",
        "cloudfront:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "APIGatewayReadAccess",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNSReadAccess",
      "Effect": "Allow",
      "Action": [
        "sns:ListTopics",
        "sns:GetTopicAttributes",
        "sns:ListSubscriptions",
        "sns:ListSubscriptionsByTopic",
        "sns:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SQSReadAccess",
      "Effect": "Allow",
      "Action": [
        "sqs:ListQueues",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
        "sqs:ListQueueTags",
        "sqs:ListDeadLetterSourceQueues"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EventBridgeReadAccess",
      "Effect": "Allow",
      "Action": [
        "events:ListRules",
        "events:DescribeRule",
        "events:ListTargetsByRule",
        "events:ListEventBuses",
        "events:ListArchives",
        "events:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchReadAccess",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:DescribeAlarmHistory",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:ListDashboards",
        "cloudwatch:GetDashboard",
        "cloudwatch:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsReadAccess",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:DescribeMetricFilters",
        "logs:DescribeSubscriptionFilters",
        "logs:GetLogGroupFields",
        "logs:ListTagsLogGroup"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudTrailReadAccess",
      "Effect": "Allow",
      "Action": [
        "cloudtrail:DescribeTrails",
        "cloudtrail:GetTrailStatus",
        "cloudtrail:GetEventSelectors",
        "cloudtrail:GetInsightSelectors",
        "cloudtrail:ListTags",
        "cloudtrail:LookupEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecurityServicesReadAccess",
      "Effect": "Allow",
      "Action": [
        "guardduty:ListDetectors",
        "guardduty:GetDetector",
        "guardduty:ListFindings",
        "guardduty:GetFindings",
        "guardduty:GetFindingsStatistics",
        "guardduty:ListMembers",
        "securityhub:GetEnabledStandards",
        "securityhub:GetFindings",
        "securityhub:DescribeHub",
        "securityhub:DescribeStandards",
        "securityhub:DescribeStandardsControls",
        "inspector2:ListFindings",
        "inspector2:ListCoverage",
        "inspector2:DescribeOrganizationConfiguration",
        "access-analyzer:ListAnalyzers",
        "access-analyzer:ListFindings"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ConfigReadAccess",
      "Effect": "Allow",
      "Action": [
        "config:DescribeConfigRules",
        "config:GetComplianceSummaryByConfigRule",
        "config:GetComplianceDetailsByConfigRule",
        "config:DescribeComplianceByConfigRule",
        "config:DescribeConfigurationRecorders",
        "config:DescribeConfigurationRecorderStatus",
        "config:DescribeDeliveryChannels",
        "config:GetResourceConfigHistory"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManagerReadAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:ListSecretVersionIds"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSMReadAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:DescribeParameters",
        "ssm:GetParametersByPath",
        "ssm:DescribeInstanceInformation",
        "ssm:ListComplianceSummaries",
        "ssm:ListResourceComplianceSummaries",
        "ssm:DescribePatchBaselines",
        "ssm:DescribePatchGroups"
      ],
      "Resource": "*"
    },
    {
      "Sid": "KMSReadAccess",
      "Effect": "Allow",
      "Action": [
        "kms:ListKeys",
        "kms:ListAliases",
        "kms:DescribeKey",
        "kms:GetKeyPolicy",
        "kms:GetKeyRotationStatus",
        "kms:ListGrants",
        "kms:ListResourceTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ACMReadAccess",
      "Effect": "Allow",
      "Action": [
        "acm:ListCertificates",
        "acm:DescribeCertificate",
        "acm:GetCertificate",
        "acm:ListTagsForCertificate"
      ],
      "Resource": "*"
    },
    {
      "Sid": "WAFReadAccess",
      "Effect": "Allow",
      "Action": [
        "wafv2:ListWebACLs",
        "wafv2:GetWebACL",
        "wafv2:ListRuleGroups",
        "wafv2:GetRuleGroup",
        "wafv2:ListResourcesForWebACL",
        "wafv2:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CostExplorerReadAccess",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "ce:GetReservationUtilization",
        "ce:GetReservationPurchaseRecommendation",
        "ce:GetSavingsPlansCoverage",
        "ce:GetSavingsPlansUtilization",
        "ce:GetSavingsPlansPurchaseRecommendation",
        "ce:GetRightsizingRecommendation",
        "ce:GetTags",
        "ce:GetDimensionValues"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BudgetsReadAccess",
      "Effect": "Allow",
      "Action": [
        "budgets:ViewBudget",
        "budgets:DescribeBudgets",
        "budgets:DescribeBudgetPerformanceHistory"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BackupReadAccess",
      "Effect": "Allow",
      "Action": [
        "backup:ListBackupPlans",
        "backup:GetBackupPlan",
        "backup:ListBackupVaults",
        "backup:DescribeBackupVault",
        "backup:ListRecoveryPointsByBackupVault",
        "backup:DescribeRecoveryPoint",
        "backup:ListProtectedResources",
        "backup:ListBackupJobs",
        "backup:ListTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:DescribeRepositories",
        "ecr:DescribeImages",
        "ecr:GetLifecyclePolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:ListImages",
        "ecr:ListTagsForResource",
        "ecr:DescribeImageScanFindings"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ServiceQuotasReadAccess",
      "Effect": "Allow",
      "Action": [
        "servicequotas:ListServices",
        "servicequotas:GetServiceQuota",
        "servicequotas:ListServiceQuotas",
        "servicequotas:GetAWSDefaultServiceQuota"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TrustedAdvisorReadAccess",
      "Effect": "Allow",
      "Action": [
        "trustedadvisor:DescribeChecks",
        "trustedadvisor:DescribeCheckItems",
        "trustedadvisor:DescribeCheckSummaries",
        "support:DescribeTrustedAdvisorChecks",
        "support:DescribeTrustedAdvisorCheckResult",
        "support:DescribeTrustedAdvisorCheckSummaries"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ResourceGroupsTaggingReadAccess",
      "Effect": "Allow",
      "Action": [
        "tag:GetResources",
        "tag:GetTagKeys",
        "tag:GetTagValues",
        "resource-groups:ListGroups",
        "resource-groups:GetGroup",
        "resource-groups:ListGroupResources"
      ],
      "Resource": "*"
    },
    {
      "Sid": "HealthReadAccess",
      "Effect": "Allow",
      "Action": [
        "health:DescribeEvents",
        "health:DescribeEventDetails",
        "health:DescribeAffectedEntities"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ComputeOptimizerReadAccess",
      "Effect": "Allow",
      "Action": [
        "compute-optimizer:GetEnrollmentStatus",
        "compute-optimizer:GetEC2InstanceRecommendations",
        "compute-optimizer:GetAutoScalingGroupRecommendations",
        "compute-optimizer:GetEBSVolumeRecommendations",
        "compute-optimizer:GetLambdaFunctionRecommendations"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Permissions by Report Section

### 1. Account & Organization Overview

| Permission | Purpose |
|------------|--------|
| `sts:GetCallerIdentity` | Get current user/role identity |
| `iam:ListAccountAliases` | Get account alias |
| `organizations:DescribeOrganization` | Get organization structure |
| `organizations:ListAccounts` | List all accounts in org |
| `organizations:ListOrganizationalUnitsForParent` | Get OU hierarchy |

### 2. Compute Services (EC2, ECS, Lambda)

| Permission | Purpose |
|------------|--------|
| `ec2:DescribeInstances` | List EC2 instances |
| `ec2:DescribeVolumes` | List EBS volumes |
| `ecs:ListClusters`, `ecs:DescribeClusters` | ECS cluster info |
| `ecs:ListServices`, `ecs:DescribeServices` | ECS services |
| `lambda:ListFunctions`, `lambda:GetFunction` | Lambda functions |
| `autoscaling:DescribeAutoScalingGroups` | ASG configuration |

### 3. Database Services

| Permission | Purpose |
|------------|--------|
| `rds:DescribeDBInstances` | RDS instance details |
| `rds:DescribeDBClusters` | Aurora cluster details |
| `rds:DescribeDBSnapshots` | Backup status |
| `dynamodb:ListTables`, `dynamodb:DescribeTable` | DynamoDB tables |
| `elasticache:DescribeCacheClusters` | ElastiCache clusters |

### 4. Storage Services

| Permission | Purpose |
|------------|--------|
| `s3:ListAllMyBuckets` | List all S3 buckets |
| `s3:GetBucketEncryption` | Check encryption status |
| `s3:GetBucketPublicAccessBlock` | Check public access |
| `s3:GetBucketVersioning` | Check versioning |
| `s3:GetBucketLifecycleConfiguration` | Check lifecycle policies |

### 5. Networking

| Permission | Purpose |
|------------|--------|
| `ec2:DescribeVpcs` | VPC configuration |
| `ec2:DescribeSubnets` | Subnet details |
| `ec2:DescribeSecurityGroups` | Security group rules |
| `ec2:DescribeFlowLogs` | VPC flow logs status |
| `elasticloadbalancing:DescribeLoadBalancers` | Load balancer info |
| `route53:ListHostedZones` | DNS zones |

### 6. Security Assessment

| Permission | Purpose |
|------------|--------|
| `iam:ListUsers`, `iam:ListMFADevices` | IAM user MFA status |
| `iam:GetCredentialReport` | Credential report |
| `guardduty:ListDetectors`, `guardduty:GetFindings` | Threat detection |
| `securityhub:GetFindings` | Security findings |
| `access-analyzer:ListFindings` | IAM access analysis |
| `kms:ListKeys`, `kms:GetKeyRotationStatus` | Encryption keys |

### 7. Cost Analysis

| Permission | Purpose |
|------------|--------|
| `ce:GetCostAndUsage` | Cost data |
| `ce:GetCostForecast` | Cost predictions |
| `ce:GetReservationUtilization` | RI utilization |
| `ce:GetSavingsPlansCoverage` | SP coverage |
| `ce:GetRightsizingRecommendation` | Right-sizing suggestions |
| `budgets:DescribeBudgets` | Budget alerts |

### 8. Monitoring & Logging

| Permission | Purpose |
|------------|--------|
| `cloudwatch:DescribeAlarms` | CloudWatch alarms |
| `cloudwatch:GetMetricStatistics` | Resource metrics |
| `logs:DescribeLogGroups` | Log group inventory |
| `cloudtrail:DescribeTrails` | CloudTrail configuration |
| `config:DescribeConfigRules` | AWS Config rules |

### 9. Compliance & Governance

| Permission | Purpose |
|------------|--------|
| `config:GetComplianceDetailsByConfigRule` | Config compliance |
| `securityhub:DescribeStandards` | Security standards |
| `tag:GetResources` | Tagging compliance |
| `backup:ListBackupPlans` | Backup policies |

---

## IAM Trust Policy (For Cross-Account Access)

If you're providing access from an external account (consultant access):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::CONSULTANT_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "UNIQUE_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

---

## Setup Instructions

### Option 1: Using AWS Managed Policies

```bash
# Create IAM user
aws iam create-user --user-name aws-audit-user

# Attach managed policies
aws iam attach-user-policy --user-name aws-audit-user \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

aws iam attach-user-policy --user-name aws-audit-user \
  --policy-arn arn:aws:iam::aws:policy/SecurityAudit

# Create access keys
aws iam create-access-key --user-name aws-audit-user
```

### Option 2: Using Custom Policy

```bash
# Create custom policy
aws iam create-policy --policy-name AWSInfrastructureAuditPolicy \
  --policy-document file://audit-policy.json

# Create IAM role for cross-account access
aws iam create-role --role-name AWSAuditRole \
  --assume-role-policy-document file://trust-policy.json

# Attach custom policy to role
aws iam attach-role-policy --role-name AWSAuditRole \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/AWSInfrastructureAuditPolicy
```

### Option 3: Temporary Credentials (Recommended)

```bash
# Assume role for temporary access
aws sts assume-role \
  --role-arn arn:aws:iam::TARGET_ACCOUNT:role/AWSAuditRole \
  --role-session-name audit-session \
  --external-id UNIQUE_EXTERNAL_ID
```

---

## Security Best Practices

1. **Use Temporary Credentials**: Prefer IAM roles with `sts:AssumeRole` over long-lived access keys
2. **External ID**: Use external IDs for cross-account access to prevent confused deputy attacks
3. **Session Duration**: Limit session duration (e.g., 1-4 hours)
4. **MFA Required**: Require MFA for assuming the audit role
5. **IP Restrictions**: Consider adding IP-based conditions
6. **Audit Logging**: Enable CloudTrail to log all API calls made during audit
7. **Time-Limited Access**: Remove or disable access after audit completion

### Example: MFA-Required Condition

```json
{
  "Condition": {
    "Bool": {
      "aws:MultiFactorAuthPresent": "true"
    },
    "NumericLessThan": {
      "aws:MultiFactorAuthAge": "3600"
    }
  }
}
```

### Example: IP Restriction

```json
{
  "Condition": {
    "IpAddress": {
      "aws:SourceIp": ["203.0.113.0/24", "198.51.100.0/24"]
    }
  }
}
```

---

## Permissions NOT Included (By Design)

The following actions are **intentionally excluded** as they are not needed for read-only analysis:

| Action Type | Examples | Reason |
|-------------|----------|--------|
| Create/Modify/Delete | `ec2:RunInstances`, `s3:PutObject` | Not needed for audit |
| Secret Values | `secretsmanager:GetSecretValue` | Security risk |
| Data Access | `s3:GetObject`, `dynamodb:GetItem` | Not needed |
| Write Actions | `*:Create*`, `*:Put*`, `*:Delete*` | Read-only audit |

---

## Verification Commands

After setting up permissions, verify access with:

```bash
# Test basic access
aws sts get-caller-identity --profile audit-profile

# Test EC2 access
aws ec2 describe-instances --profile audit-profile --region us-east-1 --max-items 1

# Test IAM access
aws iam list-users --profile audit-profile --max-items 1

# Test S3 access
aws s3api list-buckets --profile audit-profile --max-items 1

# Test Cost Explorer access
aws ce get-cost-and-usage --profile audit-profile \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

---

## Troubleshooting Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `AccessDenied` | Missing permission | Add specific permission to policy |
| `UnauthorizedOperation` | EC2 permission missing | Add `ec2:Describe*` actions |
| `InvalidClientTokenId` | Bad credentials | Verify access keys |
| `ExpiredToken` | Session expired | Refresh temporary credentials |
| `OptInRequired` | Service not enabled | Enable service in account |

---

## Summary

| Approach | Pros | Cons |
|----------|------|------|
| **ReadOnlyAccess** (Managed) | Easy setup, comprehensive | May include more than needed |
| **SecurityAudit** (Managed) | Security-focused | Limited to security checks |
| **Custom Policy** | Least privilege, specific | More setup, maintenance |
| **Cross-Account Role** | No credentials shared | Requires role setup |

**Recommendation:** For client engagements, use a **cross-account IAM role** with the **custom policy** for maximum security and least privilege.

---

*Document Version: 1.0*  
*Last Updated: December 2025*
