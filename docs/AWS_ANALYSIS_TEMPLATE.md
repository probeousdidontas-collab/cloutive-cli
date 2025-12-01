# AWS Infrastructure Analysis Report

<div align="center">

![AWS](https://img.shields.io/badge/AWS-Certified_Consultant-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)

**Confidential Client Document**

</div>

---

## Document Information

| Field | Value |
|-------|-------|
| **Client Name** | `[CLIENT_NAME]` |
| **AWS Account ID(s)** | `[ACCOUNT_ID]` |
| **Report Date** | `[DATE]` |
| **Report Version** | 1.0 |
| **Prepared By** | `[CONSULTANT_NAME]` |
| **Certification** | AWS Certified Solutions Architect / DevOps Engineer |
| **Review Period** | `[START_DATE]` to `[END_DATE]` |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Account & Organization Overview](#2-account--organization-overview)
3. [Infrastructure Inventory](#3-infrastructure-inventory)
4. [Security Assessment](#4-security-assessment)
5. [Cost Analysis & Optimization](#5-cost-analysis--optimization)
6. [Performance & Reliability](#6-performance--reliability)
7. [Operational Excellence](#7-operational-excellence)
8. [Compliance & Governance](#8-compliance--governance)
9. [Risk Assessment Matrix](#9-risk-assessment-matrix)
10. [Recommendations & Action Plan](#10-recommendations--action-plan)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### 1.1 Overall Health Score

| Pillar | Score | Status |
|--------|-------|--------|
| Security | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |
| Cost Efficiency | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |
| Reliability | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |
| Performance | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |
| Operational Excellence | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |
| **Overall** | `__/100` | 🔴 Critical / 🟡 Needs Attention / 🟢 Good |

### 1.2 Key Findings Summary

#### 🔴 Critical Issues (Immediate Action Required)

| # | Issue | Impact | Affected Resources | Est. Savings/Risk |
|---|-------|--------|---------------------|-------------------|
| 1 | `[ISSUE]` | `[IMPACT]` | `[RESOURCES]` | `[VALUE]` |
| 2 | | | | |
| 3 | | | | |

#### 🟡 Important Issues (Action Within 30 Days)

| # | Issue | Impact | Affected Resources | Est. Savings/Risk |
|---|-------|--------|---------------------|-------------------|
| 1 | `[ISSUE]` | `[IMPACT]` | `[RESOURCES]` | `[VALUE]` |
| 2 | | | | |
| 3 | | | | |

#### 🟢 Optimization Opportunities

| # | Opportunity | Benefit | Effort | Priority |
|---|-------------|---------|--------|----------|
| 1 | `[OPPORTUNITY]` | `[BENEFIT]` | Low/Med/High | P1/P2/P3 |
| 2 | | | | |
| 3 | | | | |

### 1.3 Cost Overview

| Metric | Value |
|--------|-------|
| **Current Monthly Spend** | $`[AMOUNT]` |
| **Projected Annual Spend** | $`[AMOUNT]` |
| **Identified Savings** | $`[AMOUNT]` (`[%]`%) |
| **YoY Cost Trend** | +/-`[%]`% |

---

## 2. Account & Organization Overview

### 2.1 AWS Organization Structure

```
[ORGANIZATION_ROOT]
├── Management Account: [ACCOUNT_ID]
├── OU: Production
│   ├── Account: prod-workloads ([ACCOUNT_ID])
│   └── Account: prod-data ([ACCOUNT_ID])
├── OU: Development
│   ├── Account: dev ([ACCOUNT_ID])
│   └── Account: staging ([ACCOUNT_ID])
├── OU: Security
│   └── Account: security-audit ([ACCOUNT_ID])
└── OU: Shared Services
    └── Account: shared-infra ([ACCOUNT_ID])
```

### 2.2 Account Details

| Account Name | Account ID | Purpose | Primary Region | Monthly Cost |
|--------------|------------|---------|----------------|-------------|
| `[NAME]` | `[ID]` | `[PURPOSE]` | `[REGION]` | $`[COST]` |
| | | | | |

### 2.3 Active Regions

| Region | Services Active | Est. Monthly Cost | Primary Use |
|--------|-----------------|-------------------|-------------|
| `[REGION]` | `[COUNT]` | $`[COST]` | `[USE_CASE]` |
| | | | |

### 2.4 IAM Identity Center (SSO) Configuration

| Setting | Value | Recommendation |
|---------|-------|----------------|
| Identity Source | `[AWS/External IdP]` | |
| MFA Enforcement | `[Yes/No]` | |
| Permission Sets | `[COUNT]` | |
| Groups Configured | `[COUNT]` | |

---

## 3. Infrastructure Inventory

### 3.1 Compute Services

#### EC2 Instances

| Instance ID | Name | Type | State | vCPU | Memory | AZ | Monthly Cost | Avg CPU % | Recommendation |
|-------------|------|------|-------|------|--------|----|--------------|-----------|----------------|
| `[ID]` | `[NAME]` | `[TYPE]` | `[STATE]` | `[#]` | `[GB]` | `[AZ]` | $`[COST]` | `[%]` | `[REC]` |
| | | | | | | | | | |

**EC2 Summary:**
- Total Instances: `[COUNT]`
- Running: `[COUNT]` | Stopped: `[COUNT]`
- Reserved Instances: `[COUNT]` | Savings Plans Coverage: `[%]`
- Spot Instances: `[COUNT]`

#### Auto Scaling Groups

| ASG Name | Min | Max | Desired | Current | Instance Type | Health Check |
|----------|-----|-----|---------|---------|---------------|-------------|
| `[NAME]` | `[#]` | `[#]` | `[#]` | `[#]` | `[TYPE]` | `[EC2/ELB]` |
| | | | | | | |

#### ECS/EKS Clusters

| Cluster Name | Type | Services/Pods | Tasks Running | Capacity Provider | Monthly Cost |
|--------------|------|---------------|---------------|-------------------|-------------|
| `[NAME]` | `[ECS/EKS]` | `[COUNT]` | `[COUNT]` | `[TYPE]` | $`[COST]` |
| | | | | | |

#### Lambda Functions

| Function Name | Runtime | Memory | Timeout | Invocations/Day | Avg Duration | Monthly Cost |
|---------------|---------|--------|---------|-----------------|--------------|-------------|
| `[NAME]` | `[RUNTIME]` | `[MB]` | `[SEC]` | `[COUNT]` | `[MS]` | $`[COST]` |
| | | | | | | |

**Lambda Summary:**
- Total Functions: `[COUNT]`
- Total Monthly Invocations: `[COUNT]`
- Total Monthly Cost: $`[AMOUNT]`

### 3.2 Database Services

#### RDS Instances

| DB Identifier | Engine | Version | Class | Storage | Multi-AZ | Backup Retention | Monthly Cost | CPU Util % | Recommendation |
|---------------|--------|---------|-------|---------|----------|------------------|--------------|------------|----------------|
| `[ID]` | `[ENGINE]` | `[VER]` | `[CLASS]` | `[GB]` | `[Y/N]` | `[DAYS]` | $`[COST]` | `[%]` | `[REC]` |
| | | | | | | | | | |

#### DynamoDB Tables

| Table Name | Capacity Mode | RCU | WCU | Storage GB | GSI Count | Monthly Cost |
|------------|---------------|-----|-----|------------|-----------|-------------|
| `[NAME]` | `[PROVISIONED/ON-DEMAND]` | `[#]` | `[#]` | `[GB]` | `[#]` | $`[COST]` |
| | | | | | | |

#### ElastiCache Clusters

| Cluster ID | Engine | Node Type | Nodes | Multi-AZ | Monthly Cost |
|------------|--------|-----------|-------|----------|-------------|
| `[ID]` | `[Redis/Memcached]` | `[TYPE]` | `[#]` | `[Y/N]` | $`[COST]` |
| | | | | | |

### 3.3 Storage Services

#### S3 Buckets

| Bucket Name | Region | Storage Class | Size (GB) | Objects | Versioning | Encryption | Lifecycle | Public | Monthly Cost |
|-------------|--------|---------------|-----------|---------|------------|------------|-----------|--------|-------------|
| `[NAME]` | `[REGION]` | `[CLASS]` | `[GB]` | `[COUNT]` | `[Y/N]` | `[TYPE]` | `[Y/N]` | `[Y/N]` | $`[COST]` |
| | | | | | | | | | |

**S3 Summary:**
- Total Buckets: `[COUNT]`
- Total Storage: `[TB]` TB
- Public Buckets: `[COUNT]` ⚠️
- Buckets without Encryption: `[COUNT]` ⚠️
- Buckets without Lifecycle: `[COUNT]`

#### EBS Volumes

| Volume ID | Name | Type | Size (GB) | IOPS | Attached To | State | Snapshot | Monthly Cost |
|-----------|------|------|-----------|------|-------------|-------|----------|-------------|
| `[ID]` | `[NAME]` | `[TYPE]` | `[GB]` | `[#]` | `[INSTANCE]` | `[STATE]` | `[Y/N]` | $`[COST]` |
| | | | | | | | | |

**EBS Summary:**
- Total Volumes: `[COUNT]`
- Unattached Volumes: `[COUNT]` ⚠️ (Potential savings: $`[AMOUNT]`/mo)
- Volumes without Snapshots: `[COUNT]` ⚠️
- gp2 Volumes (consider gp3): `[COUNT]`

#### EFS File Systems

| File System ID | Name | Performance Mode | Throughput Mode | Size (GB) | Monthly Cost |
|----------------|------|------------------|-----------------|-----------|-------------|
| `[ID]` | `[NAME]` | `[MODE]` | `[MODE]` | `[GB]` | $`[COST]` |
| | | | | | |

### 3.4 Networking

#### VPCs

| VPC ID | Name | CIDR | Subnets | NAT Gateways | VPN | Peering | Flow Logs |
|--------|------|------|---------|--------------|-----|---------|----------|
| `[ID]` | `[NAME]` | `[CIDR]` | `[#]` | `[#]` | `[Y/N]` | `[#]` | `[Y/N]` |
| | | | | | | | |

#### Load Balancers

| Name | Type | Scheme | AZs | Targets | Health | Monthly Cost |
|------|------|--------|-----|---------|--------|-------------|
| `[NAME]` | `[ALB/NLB/CLB]` | `[internet/internal]` | `[#]` | `[#]` | `[healthy/unhealthy]` | $`[COST]` |
| | | | | | | |

#### Route 53

| Hosted Zone | Type | Records | Query Volume/Mo | Monthly Cost |
|-------------|------|---------|-----------------|-------------|
| `[DOMAIN]` | `[Public/Private]` | `[#]` | `[COUNT]` | $`[COST]` |
| | | | | |

#### CloudFront Distributions

| Distribution ID | Domain | Origin | Price Class | WAF | Monthly Cost |
|-----------------|--------|--------|-------------|-----|-------------|
| `[ID]` | `[DOMAIN]` | `[ORIGIN]` | `[CLASS]` | `[Y/N]` | $`[COST]` |
| | | | | | |

### 3.5 Application Integration

#### API Gateway

| API Name | Type | Endpoints | Requests/Mo | Stage(s) | Monthly Cost |
|----------|------|-----------|-------------|----------|-------------|
| `[NAME]` | `[REST/HTTP/WebSocket]` | `[#]` | `[COUNT]` | `[STAGES]` | $`[COST]` |
| | | | | | |

#### SNS Topics

| Topic Name | Subscriptions | Messages/Mo | Monthly Cost |
|------------|---------------|-------------|-------------|
| `[NAME]` | `[#]` | `[COUNT]` | $`[COST]` |
| | | | |

#### SQS Queues

| Queue Name | Type | Messages/Mo | Avg Size | DLQ | Monthly Cost |
|------------|------|-------------|----------|-----|-------------|
| `[NAME]` | `[Standard/FIFO]` | `[COUNT]` | `[KB]` | `[Y/N]` | $`[COST]` |
| | | | | | |

#### EventBridge

| Rule Name | State | Schedule/Pattern | Target(s) | Invocations/Mo |
|-----------|-------|------------------|-----------|---------------|
| `[NAME]` | `[ENABLED/DISABLED]` | `[PATTERN]` | `[TARGETS]` | `[COUNT]` |
| | | | | |

---

## 4. Security Assessment

### 4.1 Identity & Access Management

#### IAM Users

| Username | MFA | Access Keys | Last Activity | Console Access | Groups | Risk Level |
|----------|-----|-------------|---------------|----------------|--------|------------|
| `[USER]` | `[Y/N]` | `[#]` | `[DATE]` | `[Y/N]` | `[GROUPS]` | 🔴🟡🟢 |
| | | | | | | |

**IAM User Findings:**
- [ ] Users without MFA: `[COUNT]` ⚠️
- [ ] Root account MFA enabled: `[Y/N]`
- [ ] Access keys older than 90 days: `[COUNT]` ⚠️
- [ ] Unused credentials (90+ days): `[COUNT]`
- [ ] Users with admin access: `[COUNT]`

#### IAM Roles

| Role Name | Trusted Entity | Last Used | Policies | Cross-Account | Risk |
|-----------|----------------|-----------|----------|---------------|------|
| `[ROLE]` | `[ENTITY]` | `[DATE]` | `[#]` | `[Y/N]` | 🔴🟡🟢 |
| | | | | | |

**IAM Role Findings:**
- [ ] Roles with `*` permissions: `[COUNT]` ⚠️
- [ ] Unused roles (90+ days): `[COUNT]`
- [ ] Cross-account roles: `[COUNT]`
- [ ] Service-linked roles: `[COUNT]`

#### IAM Policies

| Policy Name | Type | Attachments | Admin Access | Last Modified |
|-------------|------|-------------|--------------|---------------|
| `[POLICY]` | `[AWS/Customer]` | `[#]` | `[Y/N]` | `[DATE]` |
| | | | | |

### 4.2 Network Security

#### Security Groups Analysis

| SG ID | Name | VPC | Inbound Rules | Outbound Rules | 0.0.0.0/0 Rules | Risk |
|-------|------|-----|---------------|----------------|-----------------|------|
| `[ID]` | `[NAME]` | `[VPC]` | `[#]` | `[#]` | `[#]` | 🔴🟡🟢 |
| | | | | | | |

**Security Group Findings:**
- [ ] SGs with 0.0.0.0/0 on port 22 (SSH): `[COUNT]` 🔴
- [ ] SGs with 0.0.0.0/0 on port 3389 (RDP): `[COUNT]` 🔴
- [ ] SGs with 0.0.0.0/0 on all ports: `[COUNT]` 🔴
- [ ] Unused security groups: `[COUNT]`
- [ ] Default SGs with modified rules: `[COUNT]` ⚠️

#### Network ACLs

| NACL ID | VPC | Associated Subnets | Custom Rules | Risk |
|---------|-----|--------------------|--------------|------|
| `[ID]` | `[VPC]` | `[#]` | `[Y/N]` | 🔴🟡🟢 |
| | | | | |

#### VPC Flow Logs

| VPC | Flow Logs Enabled | Destination | Traffic Type | Retention |
|-----|-------------------|-------------|--------------|----------|
| `[VPC]` | `[Y/N]` | `[S3/CloudWatch]` | `[ALL/ACCEPT/REJECT]` | `[DAYS]` |
| | | | | |

### 4.3 Data Protection

#### Encryption at Rest

| Service | Resource | Encryption Enabled | Key Type | Key Rotation |
|---------|----------|-------------------|----------|-------------|
| S3 | `[BUCKET]` | `[Y/N]` | `[SSE-S3/KMS/CMK]` | `[Y/N/NA]` |
| RDS | `[DB]` | `[Y/N]` | `[AWS/CMK]` | `[Y/N/NA]` |
| EBS | `[VOL]` | `[Y/N]` | `[AWS/CMK]` | `[Y/N/NA]` |
| DynamoDB | `[TABLE]` | `[Y/N]` | `[AWS/CMK]` | `[Y/N/NA]` |
| | | | | |

#### Encryption in Transit

| Service | Resource | TLS Enforced | Certificate | Expiry |
|---------|----------|--------------|-------------|--------|
| ALB | `[NAME]` | `[Y/N]` | `[ARN]` | `[DATE]` |
| CloudFront | `[ID]` | `[Y/N]` | `[ARN]` | `[DATE]` |
| API GW | `[NAME]` | `[Y/N]` | `[ARN]` | `[DATE]` |
| | | | | |

#### KMS Keys

| Key ID | Alias | Key State | Rotation | Usage | Monthly Cost |
|--------|-------|-----------|----------|-------|-------------|
| `[ID]` | `[ALIAS]` | `[STATE]` | `[Y/N]` | `[SERVICES]` | $`[COST]` |
| | | | | | |

### 4.4 Secrets Management

#### Secrets Manager

| Secret Name | Last Rotated | Auto Rotation | Last Accessed | Risk |
|-------------|--------------|---------------|---------------|------|
| `[NAME]` | `[DATE]` | `[Y/N]` | `[DATE]` | 🔴🟡🟢 |
| | | | | |

#### Parameter Store

| Parameter | Type | Encrypted | Last Modified | Tier |
|-----------|------|-----------|---------------|------|
| `[NAME]` | `[String/SecureString]` | `[Y/N]` | `[DATE]` | `[Standard/Advanced]` |
| | | | | |

### 4.5 Logging & Monitoring

#### CloudTrail

| Trail Name | Multi-Region | S3 Bucket | Log Validation | KMS Encrypted | Insights |
|------------|--------------|-----------|----------------|---------------|----------|
| `[NAME]` | `[Y/N]` | `[BUCKET]` | `[Y/N]` | `[Y/N]` | `[Y/N]` |
| | | | | | |

**CloudTrail Findings:**
- [ ] CloudTrail enabled in all regions: `[Y/N]`
- [ ] Log file validation: `[Y/N]`
- [ ] Logs encrypted: `[Y/N]`
- [ ] CloudTrail Insights enabled: `[Y/N]`

#### AWS Config

| Status | Rules Active | Non-Compliant Resources | Recorder On |
|--------|--------------|------------------------|-------------|
| `[ENABLED/DISABLED]` | `[#]` | `[#]` | `[Y/N]` |

#### GuardDuty

| Status | Findings (High) | Findings (Med) | Findings (Low) | S3 Protection | EKS Protection |
|--------|-----------------|----------------|----------------|---------------|---------------|
| `[ENABLED/DISABLED]` | `[#]` | `[#]` | `[#]` | `[Y/N]` | `[Y/N]` |

#### Security Hub

| Status | Standards Enabled | Critical | High | Medium | Low |
|--------|-------------------|----------|------|--------|-----|
| `[ENABLED/DISABLED]` | `[LIST]` | `[#]` | `[#]` | `[#]` | `[#]` |

### 4.6 Security Checklist

| Category | Check | Status | Priority | Notes |
|----------|-------|--------|----------|-------|
| **Identity** | Root MFA enabled | ✅/❌ | Critical | |
| **Identity** | No root access keys | ✅/❌ | Critical | |
| **Identity** | All users have MFA | ✅/❌ | High | |
| **Identity** | Password policy configured | ✅/❌ | High | |
| **Identity** | IAM Access Analyzer enabled | ✅/❌ | Medium | |
| **Network** | No public SSH/RDP | ✅/❌ | Critical | |
| **Network** | VPC Flow Logs enabled | ✅/❌ | High | |
| **Network** | Default SGs have no rules | ✅/❌ | Medium | |
| **Data** | S3 Block Public Access | ✅/❌ | Critical | |
| **Data** | All storage encrypted | ✅/❌ | High | |
| **Data** | KMS key rotation enabled | ✅/❌ | Medium | |
| **Logging** | CloudTrail all regions | ✅/❌ | Critical | |
| **Logging** | CloudTrail log validation | ✅/❌ | High | |
| **Detection** | GuardDuty enabled | ✅/❌ | High | |
| **Detection** | Security Hub enabled | ✅/❌ | High | |
| **Detection** | AWS Config enabled | ✅/❌ | High | |

---

## 5. Cost Analysis & Optimization

### 5.1 Cost Breakdown by Service

| Service | Current Month | Last Month | 3-Month Avg | % of Total | Trend |
|---------|---------------|------------|-------------|------------|-------|
| EC2 | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| RDS | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| S3 | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| Lambda | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| Data Transfer | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| Other | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | ↑↓→ |
| **TOTAL** | **$`[AMOUNT]`** | **$`[AMOUNT]`** | **$`[AMOUNT]`** | **100%** | ↑↓→ |

### 5.2 Cost by Environment/Tag

| Environment | Monthly Cost | % of Total | Resources |
|-------------|--------------|------------|-----------|
| Production | $`[AMOUNT]` | `[%]`% | `[#]` |
| Staging | $`[AMOUNT]` | `[%]`% | `[#]` |
| Development | $`[AMOUNT]` | `[%]`% | `[#]` |
| Untagged | $`[AMOUNT]` | `[%]`% | `[#]` ⚠️ |

### 5.3 Reserved Instances & Savings Plans

#### Current Coverage

| Service | On-Demand | Reserved/SP | Coverage % | Potential Savings |
|---------|-----------|-------------|------------|------------------|
| EC2 | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | $`[AMOUNT]` |
| RDS | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | $`[AMOUNT]` |
| ElastiCache | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | $`[AMOUNT]` |

#### Recommendations

| Recommendation | Commitment | Monthly Savings | Annual Savings | Breakeven |
|----------------|------------|-----------------|----------------|----------|
| EC2 Savings Plan (1yr) | $`[AMOUNT]`/hr | $`[AMOUNT]` | $`[AMOUNT]` | `[MONTHS]` mo |
| RDS Reserved (1yr) | `[TYPE]` | $`[AMOUNT]` | $`[AMOUNT]` | `[MONTHS]` mo |
| | | | | |

### 5.4 Cost Optimization Opportunities

#### Immediate Savings (Quick Wins)

| Opportunity | Affected Resources | Current Cost | New Cost | Monthly Savings | Action |
|-------------|-------------------|--------------|----------|-----------------|--------|
| Delete unattached EBS | `[COUNT]` volumes | $`[AMOUNT]` | $0 | $`[AMOUNT]` | Delete |
| Delete unused EIPs | `[COUNT]` IPs | $`[AMOUNT]` | $0 | $`[AMOUNT]` | Release |
| Delete old snapshots | `[COUNT]` snapshots | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | Delete/Lifecycle |
| Stop idle instances | `[COUNT]` instances | $`[AMOUNT]` | $`[AMOUNT]` | $`[AMOUNT]` | Stop/Schedule |
| Delete unused NAT GW | `[COUNT]` NAT GWs | $`[AMOUNT]` | $0 | $`[AMOUNT]` | Delete |
| **SUBTOTAL** | | | | **$`[AMOUNT]`** | |

#### Right-Sizing Opportunities

| Resource | Current | Recommended | CPU Avg | Mem Avg | Monthly Savings |
|----------|---------|-------------|---------|---------|----------------|
| `[INSTANCE]` | `[TYPE]` | `[TYPE]` | `[%]`% | `[%]`% | $`[AMOUNT]` |
| `[RDS]` | `[CLASS]` | `[CLASS]` | `[%]`% | `[%]`% | $`[AMOUNT]` |
| | | | | | |
| **SUBTOTAL** | | | | | **$`[AMOUNT]`** |

#### Architecture Optimization

| Optimization | Current State | Recommended | Est. Savings | Effort |
|--------------|---------------|-------------|--------------|--------|
| Migrate to Graviton | x86 instances | arm64 | $`[AMOUNT]`/mo | Medium |
| gp2 → gp3 migration | `[COUNT]` gp2 vols | gp3 | $`[AMOUNT]`/mo | Low |
| S3 Intelligent-Tiering | Standard only | Int-Tiering | $`[AMOUNT]`/mo | Low |
| Lambda → Fargate Spot | `[FUNCTIONS]` | Fargate Spot | $`[AMOUNT]`/mo | High |
| | | | | |

### 5.5 Total Savings Summary

| Category | Monthly Savings | Annual Savings | Implementation Effort |
|----------|-----------------|----------------|----------------------|
| Quick Wins | $`[AMOUNT]` | $`[AMOUNT]` | Low |
| Right-Sizing | $`[AMOUNT]` | $`[AMOUNT]` | Low-Medium |
| Reservations/SP | $`[AMOUNT]` | $`[AMOUNT]` | Low |
| Architecture | $`[AMOUNT]` | $`[AMOUNT]` | Medium-High |
| **TOTAL** | **$`[AMOUNT]`** | **$`[AMOUNT]`** | |

---

## 6. Performance & Reliability

### 6.1 High Availability Assessment

| Component | Multi-AZ | Auto-Recovery | Backup | RTO | RPO | Risk |
|-----------|----------|---------------|--------|-----|-----|------|
| Web Tier | `[Y/N]` | `[Y/N]` | `[Y/N]` | `[TIME]` | `[TIME]` | 🔴🟡🟢 |
| App Tier | `[Y/N]` | `[Y/N]` | `[Y/N]` | `[TIME]` | `[TIME]` | 🔴🟡🟢 |
| Database | `[Y/N]` | `[Y/N]` | `[Y/N]` | `[TIME]` | `[TIME]` | 🔴🟡🟢 |
| Cache | `[Y/N]` | `[Y/N]` | `[Y/N]` | `[TIME]` | `[TIME]` | 🔴🟡🟢 |
| Storage | `[Y/N]` | `[Y/N]` | `[Y/N]` | `[TIME]` | `[TIME]` | 🔴🟡🟢 |

### 6.2 Backup & Recovery

#### Backup Status

| Resource | Backup Method | Frequency | Retention | Last Backup | Tested | Risk |
|----------|---------------|-----------|-----------|-------------|--------|------|
| `[RESOURCE]` | `[METHOD]` | `[FREQ]` | `[DAYS]` | `[DATE]` | `[Y/N]` | 🔴🟡🟢 |
| | | | | | | |

**Backup Findings:**
- [ ] Resources without backups: `[COUNT]` ⚠️
- [ ] AWS Backup configured: `[Y/N]`
- [ ] Cross-region backups: `[Y/N]`
- [ ] Backup testing performed: `[Y/N]`

### 6.3 Performance Metrics

#### EC2/ECS Performance

| Resource | Avg CPU | Max CPU | Avg Memory | Network In | Network Out | Status |
|----------|---------|---------|------------|------------|-------------|--------|
| `[NAME]` | `[%]`% | `[%]`% | `[%]`% | `[GB]` | `[GB]` | 🔴🟡🟢 |
| | | | | | | |

#### Database Performance

| Database | Avg CPU | Connections | Read IOPS | Write IOPS | Free Storage | Status |
|----------|---------|-------------|-----------|------------|--------------|--------|
| `[NAME]` | `[%]`% | `[#]` | `[#]` | `[#]` | `[GB]` | 🔴🟡🟢 |
| | | | | | | |

#### API/Application Performance

| Endpoint | Avg Latency | P99 Latency | Error Rate | Requests/Day | Status |
|----------|-------------|-------------|------------|--------------|--------|
| `[ENDPOINT]` | `[MS]`ms | `[MS]`ms | `[%]`% | `[COUNT]` | 🔴🟡🟢 |
| | | | | | |

### 6.4 CloudWatch Alarms

| Alarm Name | Metric | Threshold | State | Actions Configured |
|------------|--------|-----------|-------|-------------------|
| `[NAME]` | `[METRIC]` | `[VALUE]` | `[OK/ALARM/INSUFFICIENT]` | `[Y/N]` |
| | | | | |

**Alarm Findings:**
- Total Alarms: `[COUNT]`
- Alarms in ALARM state: `[COUNT]` ⚠️
- Alarms without actions: `[COUNT]` ⚠️
- Missing recommended alarms: `[LIST]`

### 6.5 Reliability Checklist

| Check | Status | Priority | Notes |
|-------|--------|----------|-------|
| Multi-AZ deployments for production | ✅/❌ | Critical | |
| Auto Scaling configured | ✅/❌ | High | |
| Load balancer health checks | ✅/❌ | High | |
| Database backups automated | ✅/❌ | Critical | |
| Cross-region DR configured | ✅/❌ | Medium | |
| Backup restore tested | ✅/❌ | High | |
| CloudWatch alarms configured | ✅/❌ | High | |
| SNS notifications configured | ✅/❌ | High | |

---

## 7. Operational Excellence

### 7.1 Infrastructure as Code

| Tool | Usage | Coverage % | Repository | Last Deploy |
|------|-------|------------|------------|-------------|
| CloudFormation | `[Y/N]` | `[%]`% | `[REPO]` | `[DATE]` |
| Terraform | `[Y/N]` | `[%]`% | `[REPO]` | `[DATE]` |
| CDK | `[Y/N]` | `[%]`% | `[REPO]` | `[DATE]` |
| SAM | `[Y/N]` | `[%]`% | `[REPO]` | `[DATE]` |

**IaC Findings:**
- [ ] IaC coverage: `[%]`% ⚠️
- [ ] Drift detection enabled: `[Y/N]`
- [ ] State management: `[LOCAL/S3/TF_CLOUD]`
- [ ] Version control: `[Y/N]`

### 7.2 CI/CD Pipeline

| Pipeline | Tool | Stages | Deploy Frequency | Last Success |
|----------|------|--------|------------------|-------------|
| `[NAME]` | `[TOOL]` | `[#]` | `[FREQ]` | `[DATE]` |
| | | | | |

### 7.3 Tagging Strategy

#### Required Tags Compliance

| Tag Key | Description | Compliance % | Missing Resources |
|---------|-------------|--------------|------------------|
| Name | Resource name | `[%]`% | `[#]` |
| Environment | prod/staging/dev | `[%]`% | `[#]` |
| Owner | Team/person | `[%]`% | `[#]` |
| Project | Project name | `[%]`% | `[#]` |
| CostCenter | Billing code | `[%]`% | `[#]` |

**Overall Tag Compliance: `[%]`%** ⚠️

### 7.4 Resource Lifecycle Management

| Resource Type | Lifecycle Policy | Auto-Delete | Notification |
|---------------|------------------|-------------|-------------|
| S3 Objects | `[Y/N]` | `[Y/N]` | `[Y/N]` |
| EBS Snapshots | `[Y/N]` | `[Y/N]` | `[Y/N]` |
| AMIs | `[Y/N]` | `[Y/N]` | `[Y/N]` |
| CloudWatch Logs | `[Y/N]` | `[Y/N]` | `[Y/N]` |
| ECR Images | `[Y/N]` | `[Y/N]` | `[Y/N]` |

### 7.5 Documentation Status

| Document | Exists | Last Updated | Location |
|----------|--------|--------------|----------|
| Architecture Diagram | `[Y/N]` | `[DATE]` | `[LOCATION]` |
| Runbooks | `[Y/N]` | `[DATE]` | `[LOCATION]` |
| DR Plan | `[Y/N]` | `[DATE]` | `[LOCATION]` |
| Incident Response | `[Y/N]` | `[DATE]` | `[LOCATION]` |
| Change Management | `[Y/N]` | `[DATE]` | `[LOCATION]` |

---

## 8. Compliance & Governance

### 8.1 Compliance Frameworks

| Framework | In Scope | Status | Last Audit | Gaps |
|-----------|----------|--------|------------|------|
| SOC 2 | `[Y/N]` | `[STATUS]` | `[DATE]` | `[#]` |
| PCI-DSS | `[Y/N]` | `[STATUS]` | `[DATE]` | `[#]` |
| HIPAA | `[Y/N]` | `[STATUS]` | `[DATE]` | `[#]` |
| GDPR | `[Y/N]` | `[STATUS]` | `[DATE]` | `[#]` |
| ISO 27001 | `[Y/N]` | `[STATUS]` | `[DATE]` | `[#]` |

### 8.2 AWS Config Rules

| Rule Name | Compliance | Non-Compliant Resources | Remediation |
|-----------|------------|------------------------|-------------|
| `[RULE]` | `[COMPLIANT/NON_COMPLIANT]` | `[#]` | `[AUTO/MANUAL]` |
| | | | |

### 8.3 Service Control Policies (SCPs)

| SCP Name | Attached To | Purpose | Last Modified |
|----------|-------------|---------|---------------|
| `[NAME]` | `[OU/ACCOUNT]` | `[PURPOSE]` | `[DATE]` |
| | | | |

### 8.4 Budget & Alerts

| Budget Name | Type | Amount | Current Spend | Alert Thresholds | Status |
|-------------|------|--------|---------------|------------------|--------|
| `[NAME]` | `[COST/USAGE]` | $`[AMOUNT]` | $`[AMOUNT]` | `[%]`% | 🔴🟡🟢 |
| | | | | | |

---

## 9. Risk Assessment Matrix

### 9.1 Risk Summary

| Risk ID | Category | Description | Likelihood | Impact | Risk Level | Mitigation |
|---------|----------|-------------|------------|--------|------------|------------|
| R001 | Security | `[DESCRIPTION]` | High/Med/Low | High/Med/Low | 🔴🟡🟢 | `[ACTION]` |
| R002 | Cost | `[DESCRIPTION]` | High/Med/Low | High/Med/Low | 🔴🟡🟢 | `[ACTION]` |
| R003 | Reliability | `[DESCRIPTION]` | High/Med/Low | High/Med/Low | 🔴🟡🟢 | `[ACTION]` |
| R004 | Compliance | `[DESCRIPTION]` | High/Med/Low | High/Med/Low | 🔴🟡🟢 | `[ACTION]` |
| R005 | Operations | `[DESCRIPTION]` | High/Med/Low | High/Med/Low | 🔴🟡🟢 | `[ACTION]` |
| | | | | | | |

### 9.2 Risk Matrix

```
                    IMPACT
                Low    Medium    High
           ┌────────┬─────────┬─────────┐
     High  │ Medium │  High   │Critical │
           ├────────┼─────────┼─────────┤
LIKELIHOOD │        │         │         │
    Medium │  Low   │ Medium  │  High   │
           ├────────┼─────────┼─────────┤
     Low   │  Low   │  Low    │ Medium  │
           └────────┴─────────┴─────────┘
```

### 9.3 Risk Distribution

| Risk Level | Count | % of Total |
|------------|-------|------------|
| 🔴 Critical | `[#]` | `[%]`% |
| 🟠 High | `[#]` | `[%]`% |
| 🟡 Medium | `[#]` | `[%]`% |
| 🟢 Low | `[#]` | `[%]`% |

---

## 10. Recommendations & Action Plan

### 10.1 Prioritized Recommendations

#### 🔴 Critical (Immediate - Within 7 Days)

| # | Recommendation | Category | Effort | Impact | Owner | Due Date |
|---|----------------|----------|--------|--------|-------|----------|
| 1 | `[RECOMMENDATION]` | Security/Cost/Reliability | Days | High | `[OWNER]` | `[DATE]` |
| 2 | | | | | | |
| 3 | | | | | | |

#### 🟠 High Priority (Within 30 Days)

| # | Recommendation | Category | Effort | Impact | Owner | Due Date |
|---|----------------|----------|--------|--------|-------|----------|
| 1 | `[RECOMMENDATION]` | Security/Cost/Reliability | Days/Weeks | High/Med | `[OWNER]` | `[DATE]` |
| 2 | | | | | | |
| 3 | | | | | | |

#### 🟡 Medium Priority (Within 90 Days)

| # | Recommendation | Category | Effort | Impact | Owner | Due Date |
|---|----------------|----------|--------|--------|-------|----------|
| 1 | `[RECOMMENDATION]` | Security/Cost/Reliability | Weeks | Medium | `[OWNER]` | `[DATE]` |
| 2 | | | | | | |
| 3 | | | | | | |

#### 🟢 Low Priority (Backlog)

| # | Recommendation | Category | Effort | Impact | Notes |
|---|----------------|----------|--------|--------|-------|
| 1 | `[RECOMMENDATION]` | Optimization | Weeks/Months | Low | `[NOTES]` |
| 2 | | | | | |
| 3 | | | | | |

### 10.2 Implementation Roadmap

```
Week 1-2: Critical Security Fixes
├── Enable MFA for all users
├── Remediate public S3 buckets
├── Close unnecessary inbound ports
└── Enable CloudTrail in all regions

Week 3-4: Cost Optimization Quick Wins
├── Delete unattached EBS volumes
├── Release unused Elastic IPs
├── Implement S3 lifecycle policies
└── Right-size underutilized instances

Month 2: High Availability & Reliability
├── Enable Multi-AZ for production databases
├── Configure Auto Scaling groups
├── Implement backup automation
└── Set up CloudWatch alarms

Month 3: Governance & Optimization
├── Implement tagging strategy
├── Purchase Reserved Instances/Savings Plans
├── Enable AWS Config rules
└── Document architecture
```

### 10.3 Estimated Outcomes

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Monthly Cost | $`[AMOUNT]` | $`[AMOUNT]` | -`[%]`% |
| Security Score | `[#]`/100 | `[#]`/100 | +`[#]` pts |
| Reliability Score | `[#]`/100 | `[#]`/100 | +`[#]` pts |
| Compliance % | `[%]`% | `[%]`% | +`[%]`% |

---

## 11. Appendices

### Appendix A: AWS CLI Commands Used

```bash
# Account Information
aws sts get-caller-identity
aws organizations describe-organization

# EC2 Inventory
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,Tags[?Key==`Name`].Value|[0]]' --output table

# RDS Inventory
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,Engine,DBInstanceStatus]' --output table

# S3 Inventory
aws s3api list-buckets --query 'Buckets[*].[Name,CreationDate]' --output table

# Security Groups
aws ec2 describe-security-groups --query 'SecurityGroups[*].[GroupId,GroupName,Description]' --output table

# IAM Users
aws iam list-users --query 'Users[*].[UserName,CreateDate,PasswordLastUsed]' --output table

# Cost Explorer (Last 30 days)
aws ce get-cost-and-usage --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) --granularity MONTHLY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE

# CloudTrail Status
aws cloudtrail describe-trails --query 'trailList[*].[Name,IsMultiRegionTrail,S3BucketName]' --output table

# GuardDuty Status
aws guardduty list-detectors

# Config Rules
aws configservice describe-config-rules --query 'ConfigRules[*].[ConfigRuleName,ConfigRuleState]' --output table
```

### Appendix B: Cost Explorer Queries

```bash
# Cost by Service
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-12-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Cost by Tag
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-12-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Environment

# Savings Plan Recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days SIXTY_DAYS
```

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| **AZ** | Availability Zone - Isolated data center within a region |
| **ALB** | Application Load Balancer |
| **ASG** | Auto Scaling Group |
| **CMK** | Customer Master Key (KMS) |
| **DR** | Disaster Recovery |
| **EBS** | Elastic Block Store |
| **ECS** | Elastic Container Service |
| **EKS** | Elastic Kubernetes Service |
| **IAM** | Identity and Access Management |
| **KMS** | Key Management Service |
| **NACL** | Network Access Control List |
| **NAT GW** | NAT Gateway |
| **RI** | Reserved Instance |
| **RPO** | Recovery Point Objective |
| **RTO** | Recovery Time Objective |
| **SCP** | Service Control Policy |
| **SG** | Security Group |
| **SP** | Savings Plan |
| **VPC** | Virtual Private Cloud |

### Appendix D: Reference Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           VPC (10.0.0.0/16)                            │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                        Public Subnets                            │  │  │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                         │  │  │
│  │  │   │ NAT GW  │  │   ALB   │  │ Bastion │                         │  │  │
│  │  │   └─────────┘  └─────────┘  └─────────┘                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                       Private Subnets                            │  │  │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │  │  │
│  │  │   │ ECS/EKS │  │ ECS/EKS │  │ Lambda  │  │ Lambda  │           │  │  │
│  │  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘           │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                       Database Subnets                           │  │  │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                         │  │  │
│  │  │   │   RDS   │  │   RDS   │  │ElastiC. │                         │  │  │
│  │  │   │(Primary)│  │(Standby)│  │(Redis)  │                         │  │  │
│  │  │   └─────────┘  └─────────┘  └─────────┘                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │      S3       │  │  CloudFront   │  │   Route 53    │  │     WAF     │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | `[DATE]` | `[AUTHOR]` | Initial draft |
| | | | |

---

**Disclaimer:** This report is based on the AWS resources and configurations observed at the time of analysis. AWS environments are dynamic, and resource states may change. This report should be used as a point-in-time assessment.

---

<div align="center">

**© 2024 [CONSULTANT_NAME/COMPANY]**

*AWS Certified Solutions Architect | DevOps Engineer*

</div>
