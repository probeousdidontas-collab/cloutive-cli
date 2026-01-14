# Analysis & Suggested Changes for AWS Report Generation

## Overview
You requested to generate specific AWS reports (`cost-analysis-2025-12-07.pdf`) and analyze the provided prompt (`aws-solutions-architect-cost-analyzer.md`) against your System Snapshot and Analysis Template.

## Analysis of Existing Files

### 1. Customer Prompt (`aws-solutions-architect-cost-analyzer.md`)
*   **Strengths**: This is a high-quality "Agent System Prompt" optimized for **CLI execution**. It has rigorous logic for fetching cost data, detecting anomalies using statistical methods (Z-score), and formatting output for ApexCharts/PDF.
*   **Weaknesses**: 
    1.  **Context-Blind**: It does not read `AWS_SYSTEM_SNAPSHOT.md`, so it doesn't know *what* the services are (e.g., it sees an RDS cost spike but doesn't know it's the "VIPResponse Primary DB").
    2.  **Format Mismatch**: It targets a specific HTML/PDF output, which differs from your target `docs/AWS_ANALYSIS_TEMPLATE.md`.
    3.  **Scope**: It covers *only* Cost, whereas your Template covers Security, Reliability, etc.

### 2. System Snapshot (`artifacts/AWS_SYSTEM_SNAPSHOT.md`)
*   **Role**: Provides the "Inventory" (What exists).
*   **Gap**: Lacks "Cost" data (How much it costs). It cannot Generate the cost report on its own.

### 3. Analysis Template (`docs/AWS_ANALYSIS_TEMPLATE.md`)
*   **Role**: The destination format.
*   **Gap**: Needs to be filled with data from both the Snapshot (Inventory) and the Cost Analyzer (Pricing/Usage).

## Suggested Changes

To "reach" the desired reports (filling the Template), we need to modify the Prompt to act as a **Bridge** between the CLI Data, the Snapshot, and the Template.

### 1. Created New Prompt: `aws-solutions-architect-report-generator.md`
I have created a new version of the prompt that:
*   **Reads the Snapshot First**: It uses `AWS_SYSTEM_SNAPSHOT.md` to understand the architecture (e.g., "This is a Test environment", "Services are Stopped schedules").
*   **Targets Markdown Output**: Instead of defining HTML/CSS for a PDF, it instructs the agent to fill the specific Markdown tables in `AWS_ANALYSIS_TEMPLATE.md`.
*   **Correlates Data**: It instructs the agent to explain cost trends using the Snapshot context (e.g., "Cost is low because this is a Test environment with scheduled stops").

### 2. Workflow Recommendation
To generate the final report:
1.  **Run the New Prompt**: Use the `aws-solutions-architect-report-generator.md` as the system prompt for your AI agent.
2.  **Provide Context**: Ensure the agent has read access to `artifacts/AWS_SYSTEM_SNAPSHOT.md`.
3.  **Authentication**: Ensure the agent's environment has `aws` CLI authenticated (as required by the original prompt logic).
4.  **Result**: The agent will output a `AWS_ANALYSIS_REPORT_FILLED.md` which you can then convert to PDF if desired, or keep as a living Markdown document.

## Summary of Modifications to Logic
| Feature | Original Prompt | New Suggested Prompt |
|---------|-----------------|----------------------|
| **Input Data** | AWS CLI Cost Explorer | AWS CLI + `AWS_SYSTEM_SNAPSHOT.md` |
| **Output Format** | HTML/PDF + ApexCharts | Markdown (Template Compliant) |
| **Analysis Depth**| Statistical Cost Trends | Contextual Cost Analysis (Why vs What) |
| **Scope** | Cost Only | Cost + Inventory Validation |

This approach allows you to maintain the rigour of the customer's cost analysis while aligning it with your standardized reporting template and system knowledge.
