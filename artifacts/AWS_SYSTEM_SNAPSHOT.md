# AWS System Snapshot

**Generated:** December 1, 2025  
**AWS Account ID:** 767397767820  
**Primary Region:** eu-central-1  
**Profile:** system9  
**Authenticated User:** serkantmp

---

## Executive Summary

This AWS account hosts the **VIPResponse** and **VIPLeads** test/staging environment infrastructure. The system uses a microservices architecture deployed on **ECS (Elastic Container Service)** with multiple application load balancers, backed by **MariaDB (RDS)** and **MongoDB** databases.

### Current System Status: ⚠️ SERVICES DOWN

**Critical Issue:** All 11 ECS services have 0 running tasks despite desired counts being set. This indicates the services are unable to launch their tasks.

---

## Table of Contents

1. [Compute Services](#1-compute-services)
2. [Database Services](#2-database-services)
3. [Storage Services](#3-storage-services)
4. [Networking](#4-networking)
5. [Security](#5-security)
6. [Monitoring & Alerting](#6-monitoring--alerting)
7. [Serverless & Event-Driven](#7-serverless--event-driven)
8. [Identity & Access Management](#8-identity--access-management)
9. [DNS & Content Delivery](#9-dns--content-delivery)
10. [Configuration & Secrets](#10-configuration--secrets)

---

## 1. Compute Services

### ECS (Elastic Container Service)

**Cluster:** `vipresponse-test-ecs-cluster`

#### ECS Services (11 total)

| Service Name | Status | Desired | Running | Notes |
|-------------|--------|---------|---------|-------|
| ecs-service-apiVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-apiVipleads | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-adminVipleads | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-adminVipleadsCron | ACTIVE | - | - | Cron job service |
| ecs-service-listVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-kioskVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-publisherVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-dashboardVipresponse | ACTIVE | 2 | 0 | ⚠️ Not running |
| ecs-service-dailymailzVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-trackingVipresponse | ACTIVE | 1 | 0 | ⚠️ Not running |
| ecs-service-mongodbBackupCron | ACTIVE | - | - | Cron job service |

### EC2 Instances

**Status:** No EC2 instances found in eu-central-1 region.

### ECR (Container Registry)

| Repository | URI |
|-----------|-----|
| cdk-hnb659fds-container-assets-767397767820-eu-central-1 | 767397767820.dkr.ecr.eu-central-1.amazonaws.com/... |

---

## 2. Database Services

### RDS (Relational Database Service)

| Instance ID | Engine | Class | Storage | Status | Endpoint |
|------------|--------|-------|---------|--------|----------|
| vipresponse-test-db-primary-instance | MariaDB | db.t4g.large | 100 GB | 🔴 STOPPED | vipresponse-test-db-primary-instance.cb80c6o0gfbu.eu-central-1.rds.amazonaws.com |

### MongoDB

- **Type:** Self-managed on ECS/EC2
- **Configuration:** Sharded cluster with replica sets
- **Backup Service:** `ecs-service-mongodbBackupCron`
- **Backup Bucket:** `vipresponse-test-mongodb-backups`

---

## 3. Storage Services

### S3 Buckets (8 total)

| Bucket Name | Purpose | Created |
|-------------|---------|--------|
| vip-poc-recordings2-767397767820 | Voice recordings | 2025-11-25 |
| vip-poc-website-767397767820 | Static website hosting | 2025-11-25 |
| vipresponse-test-cloudtrail-767397767820 | CloudTrail logs | 2024-08-28 |
| vipresponse-test-loadbalancer-logs | ALB access logs | 2024-05-27 |
| vipresponse-test-mongodb-backups | MongoDB backups | 2025-03-12 |
| cdk-hnb659fds-assets-767397767820-eu-central-1 | CDK assets | 2024-04-15 |
| aws-sam-cli-managed-default-samclisourcebucket-db2sagclh8u5 | SAM CLI | 2025-11-25 |
| aws-sam-cli-managed-default-samclisourcebucket-j3iq8gnvwt6e | SAM CLI | 2025-11-25 |

---

## 4. Networking

### VPCs (2 total)

| VPC ID | Name | CIDR Block | State |
|--------|------|------------|-------|
| vpc-016c9e56712d0170b | vipresponse-test-main-vpc | 10.10.0.0/16 | available |
| vpc-0a802cbe3257b7e71 | Default VPC | 172.31.0.0/16 | available |

### Subnets (48 total)

The main VPC (`vipresponse-test-main-vpc`) contains 45 subnets distributed across:
- **eu-central-1a**
- **eu-central-1b**  
- **eu-central-1c**

**Subnet Categories:**
- ECS Service subnets (9 services × 3 AZs)
- RDS subnets (3)
- DocumentDB subnets (3)
- MongoDB subnets (3)
- EFS subnets (3)
- Public subnets (3)
- Bastion subnets (3)
- Transit Gateway subnets (3)

### Load Balancers (9 Application Load Balancers)

| Name | Type | State | DNS Name |
|------|------|-------|----------|
| lb-apiVipresponse | ALB | active | lb-apiVipresponse-518089385.eu-central-1.elb.amazonaws.com |
| lb-apiVipleads | ALB | active | lb-apiVipleads-1047137300.eu-central-1.elb.amazonaws.com |
| lb-adminVipleads | ALB | active | lb-adminVipleads-87883747.eu-central-1.elb.amazonaws.com |
| lb-listVipresponse | ALB | active | lb-listVipresponse-427077927.eu-central-1.elb.amazonaws.com |
| lb-kioskVipresponse | ALB | active | lb-kioskVipresponse-1574330997.eu-central-1.elb.amazonaws.com |
| lb-publisherVipresponse | ALB | active | lb-publisherVipresponse-1381657260.eu-central-1.elb.amazonaws.com |
| lb-dashboardVipresponse | ALB | active | lb-dashboardVipresponse-1368954590.eu-central-1.elb.amazonaws.com |
| lb-dailymailzVipresponse | ALB | active | lb-dailymailzVipresponse-1967181139.eu-central-1.elb.amazonaws.com |
| lb-trackingVipresponse | ALB | active | lb-trackingVipresponse-1537893956.eu-central-1.elb.amazonaws.com |

---

## 5. Security

### Security Groups (28 total)

**By Category:**

| Category | Count | Examples |
|----------|-------|----------|
| Load Balancer SGs | 8 | vipresponse-test-ecs-loadbalancer-sg-* |
| ECS Service SGs | 9 | vipresponse-test-ecs-service-sg-* |
| Database SGs | 4 | vipresponse-test-rds-sg, mongo-db-sg, documentdb-sg |
| Infrastructure SGs | 5 | efs-security-group, lambda-health-check-sg, bastion-sg |
| Default SGs | 2 | One per VPC |

---

## 6. Monitoring & Alerting

### CloudWatch Alarms (84 total)

| State | Count | Description |
|-------|-------|-------------|
| 🔴 ALARM | 12 | Active alarms requiring attention |
| ✅ OK | 16 | Healthy state |
| ⚪ INSUFFICIENT_DATA | 56 | No recent data points |

**Active Alarms (12):**
- Health check failures for: apiVipresponse, apiVipleads, adminVipleads, listVipresponse, publisherVipresponse, trackingVipresponse, dashboardVipresponse
- MongoDB status alarms for shards 1-3 and replica sets
- ECS Cluster capacity provider reservation

**Monitored Metrics:**
- CPUUtilization
- MemoryUtilization
- HealthCheckResponse
- HTTPCode_Target_5XX_Count
- TargetResponseTime

### CloudWatch Log Groups (60 total)

- **Retention:** 3 days (all groups)
- **Categories:**
  - Lambda functions (38 groups)
  - ECS/Container Insights (13 groups)
  - DocumentDB profiler (1 group)
  - DMS tasks (1 group)
  - General/Legacy (7 groups)

---

## 7. Serverless & Event-Driven

### Lambda Functions (24 total)

**All functions use Python 3.12 runtime with 128 MB memory.**

| Category | Functions | Timeout |
|----------|-----------|--------|
| Health Checks | 8 | 5s |
| Database Management | 3 (starter, stopper, cw-alarm-action) | 20s |
| ECS Service Management | 3 (starter, stopper, cw-alarm-action) | 20s |
| Notifications | 2 (Slack, P1/P2 tickets) | 5-30s |
| Cloutive Scheduler | 4 (starter, stopper, notification, slack) | 30-60s |

### EventBridge Rules (19 total)

| Type | Count | Schedule |
|------|-------|----------|
| Health Check Rules | 9 | Every 5 minutes |
| Database Start/Stop | 3 | 8:30 AM start, 4 PM stop (weekdays) |
| ECS Service Start/Stop | 3 | 8:30 AM start, 4 PM stop (weekdays) |
| Event-based Rules | 4 | On-demand triggers |

### SNS Topics (6 total)

| Topic | Purpose |
|-------|--------|
| cloutive-jira-ticket-topic | JIRA ticket notifications |
| cloutive-p1-ticket-topic | P1 priority tickets |
| cloutive-sns-topic | General notifications |
| vipresponse-test-p1-ticket-sns-topic | P1 ticket notifications |
| vipresponse-test-p2-ticket-sns-topic | P2 ticket notifications |
| vipresponse-test-slack-sns-topic | Slack notifications |

### SQS Queues

**Status:** No SQS queues found in eu-central-1.

---

## 8. Identity & Access Management

### IAM Users (2 total)

| Username | Created | Last Password Use |
|----------|---------|------------------|
| serkantmp | 2025-11-30 | 2025-12-01 |
| vipresponse-test-system-deployment-user | 2024-12-03 | Never (programmatic access) |

### IAM Roles (50+ total)

**Categories:**

| Category | Examples |
|----------|----------|
| Application Roles | appApiVipresponseRole, appAdminVipleadsRole, etc. |
| AWS Service Roles | AWSServiceRoleForECS, AWSServiceRoleForRDS, etc. |
| CDK Deployment Roles | cdk-hnb659fds-*-role-767397767820-eu-central-1 |
| SSO Roles | AWSReservedSSO_VipResponse-*, cloutive-sso-* |
| Custom Roles | rds-monitoring-role, PileusRole, etc. |

---

## 9. DNS & Content Delivery

### Route 53 Hosted Zones

| Zone Name | Zone ID | Record Count |
|-----------|---------|-------------|
| test.vip-aws.xyz | Z06536522BHVBJKFDJ0SN | 28 records |

### CloudFront Distributions

| Distribution ID | Domain | Status | Origin |
|-----------------|--------|--------|--------|
| E2GI39D84728NK | d150obipu3i2e0.cloudfront.net | Deployed | vip-poc-website-767397767820.s3.us-east-1.amazonaws.com |

### API Gateway

**Status:** No REST APIs found in eu-central-1.

---

## 10. Configuration & Secrets

### Secrets Manager (13 secrets)

| Secret Name | Last Accessed |
|-------------|---------------|
| infra-db-master-password | 2025-11-21 |
| infra-documentdb-master-password | 2025-05-28 |
| applications-secrets-api-vipresponse | 2025-11-27 |
| applications-secrets-api-vipleads | 2025-11-27 |
| applications-secrets-admin-vipleads | 2025-11-27 |
| applications-secrets-dashboard-vipresponse | 2025-11-27 |
| applications-secrets-tracking-vipresponse | 2025-11-27 |
| applications-secrets-publisher-vipresponse | 2025-11-27 |
| applications-secrets-list-vipresponse | 2025-11-27 |
| applications-secrets-kiosk-vipresponse | 2025-11-27 |
| applications-secrets-daily-mailz-vipresponse | 2025-11-27 |
| applications-secrets-dashboard-2-vipresponse | 2025-03-12 |
| applications-mongodb-backup | Never |

### Parameter Store (3 parameters)

| Parameter | Type | Last Modified |
|-----------|------|---------------|
| /cdk-bootstrap/hnb659fds/version | String | 2024-04-15 |
| /cloutive/p1/ticket | String | 2025-03-31 |
| application-files-gitlab-key | SecureString | 2024-09-03 |

---

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │            Route 53                      │
                                    │       test.vip-aws.xyz                   │
                                    └─────────────────┬───────────────────────┘
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                              ▼                       ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │   CloudFront    │     │      ALBs       │     │      ALBs       │
                    │  (Static Site)  │     │  (VIPResponse)  │     │  (VIPLeads)     │
                    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                             │                       │                       │
                             ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                VPC: vipresponse-test-main-vpc                          │
│                                     10.10.0.0/16                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                            ECS Cluster: vipresponse-test-ecs-cluster              │  │
│  │                                                                                   │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │  │
│  │  │ API Service │ │ Dashboard   │ │ Publisher   │ │ Tracking    │ │ List Service│ │  │
│  │  │ (VIPResp)   │ │ Service     │ │ Service     │ │ Service     │ │             │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │  │
│  │  │ Kiosk       │ │ DailyMailz  │ │ API Service │ │ Admin       │ │ Cron Jobs   │ │  │
│  │  │ Service     │ │ Service     │ │ (VIPLeads)  │ │ (VIPLeads)  │ │ (MongoDB)   │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                            │
│                    ┌──────────────────────┼──────────────────────┐                    │
│                    ▼                      ▼                      ▼                    │
│           ┌───────────────┐      ┌───────────────┐      ┌───────────────┐            │
│           │  RDS MariaDB  │      │   MongoDB     │      │     EFS       │            │
│           │   (STOPPED)   │      │  (Sharded)    │      │               │            │
│           └───────────────┘      └───────────────┘      └───────────────┘            │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Supporting Services                                        │
│                                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Lambda    │  │ EventBridge │  │     SNS     │  │  CloudWatch │  │   Secrets   │  │
│  │ (24 funcs)  │  │ (19 rules)  │  │ (6 topics)  │  │ (84 alarms) │  │  Manager    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Optimization Notes

1. **Scheduled Start/Stop:** Database and ECS services are configured to start at 8:30 AM and stop at 4 PM on weekdays, indicating cost optimization for a test environment.

2. **RDS Status:** The MariaDB RDS instance is currently stopped.

3. **Log Retention:** All CloudWatch log groups have a 3-day retention, minimizing storage costs.

---

## Recommendations

### Immediate Actions

1. **⚠️ Investigate ECS Service Failures:** All 11 ECS services have 0 running tasks. Check:
   - ECS cluster capacity
   - Task definition configurations
   - Service deployment logs
   - Auto Scaling Group status

2. **⚠️ Review Active Alarms:** 12 alarms are in ALARM state, including health checks and MongoDB status.

### Best Practices

1. **Enable Secrets Rotation:** Consider enabling automatic rotation for Secrets Manager secrets.

2. **Review Security Groups:** 28 security groups exist; audit for unused or overly permissive rules.

3. **CloudWatch Logs:** Consider extending retention for critical logs beyond 3 days.

4. **Backup Verification:** The `applications-mongodb-backup` secret has never been accessed - verify backup jobs are functional.

---

*Document generated by AWS System Snapshot Tool*
