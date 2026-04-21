# Copy AI Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Copy AI Prompt" button to bug report and feedback items on the FeedbackAdminPage so admins can quickly copy implementation-ready prompts to paste into coding AI tools.

**Architecture:** A shared `CopyAiPromptButton` component with two prompt builder functions (`buildBugReportPrompt`, `buildFeedbackPrompt`) that generate structured markdown prompts from report data. The component uses Mantine's `CopyButton` for clipboard access and shows icon swap + toast feedback.

**Tech Stack:** React, Mantine v8 (CopyButton, ActionIcon, Tooltip), Tabler Icons, Vitest + Testing Library

---

### Task 1: Create prompt builder utility functions with tests

**Files:**
- Create: `aws-optimizer/apps/web/src/components/CopyAiPromptButton.tsx`
- Create: `aws-optimizer/apps/web/src/components/CopyAiPromptButton.test.tsx`

**Step 1: Write the failing tests for prompt builders**

Create `aws-optimizer/apps/web/src/components/CopyAiPromptButton.test.tsx`:

```tsx
import { describe, test, expect } from "vitest";
import { buildBugReportPrompt, buildFeedbackPrompt } from "./CopyAiPromptButton";

describe("buildBugReportPrompt", () => {
  test("should include title, severity, and description", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Login fails on Safari",
      description: "Users see 500 error",
      severity: "high",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/login",
      browserInfo: "Safari 17",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Fix the following bug");
    expect(prompt).toContain("Login fails on Safari");
    expect(prompt).toContain("high");
    expect(prompt).toContain("Users see 500 error");
  });

  test("should include AI fields when present", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
      aiSummary: "Summary text",
      aiRootCauseAnalysis: "Root cause text",
      aiSuggestedFix: "Fix text",
    });

    expect(prompt).toContain("Summary text");
    expect(prompt).toContain("Root cause text");
    expect(prompt).toContain("Fix text");
  });

  test("should omit AI fields when absent", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
    });

    expect(prompt).not.toContain("AI Summary");
    expect(prompt).not.toContain("Root Cause Analysis");
    expect(prompt).not.toContain("Suggested Fix");
  });

  test("should include console errors when present", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
      consoleErrors: "TypeError: undefined",
    });

    expect(prompt).toContain("TypeError: undefined");
  });
});

describe("buildFeedbackPrompt", () => {
  test("should include title, priority, and description with correct type label", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "feature_request",
      title: "Add dark mode",
      description: "Users want dark mode",
      priority: "important",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/settings",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Implement the following feature request");
    expect(prompt).toContain("Add dark mode");
    expect(prompt).toContain("important");
    expect(prompt).toContain("Users want dark mode");
  });

  test("should use correct label for change_request type", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "change_request",
      title: "Change button color",
      description: "Desc",
      priority: "nice_to_have",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Implement the following change request");
  });

  test("should include AI fields and action items when present", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "feature_request",
      title: "Feature",
      description: "Desc",
      priority: "important",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
      aiSummary: "Summary here",
      aiImpactAnalysis: "Impact here",
      aiActionItems: ["Add toggle", "Update CSS"],
    });

    expect(prompt).toContain("Summary here");
    expect(prompt).toContain("Impact here");
    expect(prompt).toContain("- Add toggle");
    expect(prompt).toContain("- Update CSS");
  });

  test("should omit AI fields when absent", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "general",
      title: "Feedback",
      description: "Desc",
      priority: "nice_to_have",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
    });

    expect(prompt).not.toContain("AI Summary");
    expect(prompt).not.toContain("Impact Analysis");
    expect(prompt).not.toContain("Action Items");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd aws-optimizer/apps/web && npx vitest run src/components/CopyAiPromptButton.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the prompt builder functions and component**

Create `aws-optimizer/apps/web/src/components/CopyAiPromptButton.tsx`:

```tsx
import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { showSuccessToast } from "../lib/notifications";

interface BugReport {
  _id: string;
  ticketNumber?: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reporterName: string;
  reporterEmail: string;
  url: string;
  browserInfo: string;
  consoleErrors?: string;
  createdAt: number;
  aiSummary?: string;
  aiRootCauseAnalysis?: string;
  aiSuggestedFix?: string;
}

interface FeedbackItem {
  _id: string;
  ticketNumber?: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  reporterName: string;
  reporterEmail: string;
  url: string;
  createdAt: number;
  aiSummary?: string;
  aiImpactAnalysis?: string;
  aiActionItems?: string[];
}

const feedbackTypeLabels: Record<string, string> = {
  feature_request: "feature request",
  change_request: "change request",
  general: "feedback",
};

export function buildBugReportPrompt(bug: BugReport): string {
  const lines: string[] = [
    "Fix the following bug in the codebase:",
    "",
    `**Bug:** ${bug.title}`,
  ];

  if (bug.ticketNumber) lines.push(`**Ticket:** ${bug.ticketNumber}`);
  lines.push(`**Severity:** ${bug.severity}`);
  lines.push(`**Status:** ${bug.status}`);
  lines.push(`**Description:** ${bug.description}`);
  lines.push(`**URL:** ${bug.url}`);
  lines.push(`**Browser:** ${bug.browserInfo}`);
  if (bug.consoleErrors) lines.push(`**Console Errors:** ${bug.consoleErrors}`);

  if (bug.aiSummary || bug.aiRootCauseAnalysis || bug.aiSuggestedFix) {
    lines.push("");
    if (bug.aiSummary) lines.push(`**AI Summary:** ${bug.aiSummary}`);
    if (bug.aiRootCauseAnalysis) lines.push(`**Root Cause Analysis:** ${bug.aiRootCauseAnalysis}`);
    if (bug.aiSuggestedFix) lines.push(`**Suggested Fix:** ${bug.aiSuggestedFix}`);
  }

  return lines.join("\n");
}

export function buildFeedbackPrompt(feedback: FeedbackItem): string {
  const typeLabel = feedbackTypeLabels[feedback.type] || feedback.type;
  const lines: string[] = [
    `Implement the following ${typeLabel} in the codebase:`,
    "",
    `**Request:** ${feedback.title}`,
  ];

  if (feedback.ticketNumber) lines.push(`**Ticket:** ${feedback.ticketNumber}`);
  lines.push(`**Priority:** ${feedback.priority}`);
  lines.push(`**Status:** ${feedback.status}`);
  lines.push(`**Description:** ${feedback.description}`);
  lines.push(`**URL:** ${feedback.url}`);

  if (feedback.aiSummary || feedback.aiImpactAnalysis || (feedback.aiActionItems && feedback.aiActionItems.length > 0)) {
    lines.push("");
    if (feedback.aiSummary) lines.push(`**AI Summary:** ${feedback.aiSummary}`);
    if (feedback.aiImpactAnalysis) lines.push(`**Impact Analysis:** ${feedback.aiImpactAnalysis}`);
    if (feedback.aiActionItems && feedback.aiActionItems.length > 0) {
      lines.push("**Action Items:**");
      for (const item of feedback.aiActionItems) {
        lines.push(`- ${item}`);
      }
    }
  }

  return lines.join("\n");
}

type CopyAiPromptButtonProps =
  | { type: "bug"; report: BugReport }
  | { type: "feedback"; report: FeedbackItem };

export function CopyAiPromptButton(props: CopyAiPromptButtonProps) {
  const promptText =
    props.type === "bug"
      ? buildBugReportPrompt(props.report)
      : buildFeedbackPrompt(props.report);

  return (
    <CopyButton value={promptText}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied!" : "Copy AI prompt"}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color={copied ? "green" : "gray"}
            onClick={() => {
              copy();
              showSuccessToast("AI prompt copied to clipboard");
            }}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd aws-optimizer/apps/web && npx vitest run src/components/CopyAiPromptButton.test.tsx`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add aws-optimizer/apps/web/src/components/CopyAiPromptButton.tsx aws-optimizer/apps/web/src/components/CopyAiPromptButton.test.tsx
git commit -m "feat(feedback): add CopyAiPromptButton component with prompt builders"
```

---

### Task 2: Add CopyAiPromptButton to bug report card and detail modal

**Files:**
- Modify: `aws-optimizer/apps/web/src/pages/FeedbackAdminPage.tsx`

**Step 1: Add import**

At the top of `FeedbackAdminPage.tsx`, add:

```tsx
import { CopyAiPromptButton } from "../components/CopyAiPromptButton";
```

**Step 2: Add button to BugReportCard**

In the `BugReportCard` component (around line 267-277), add the `CopyAiPromptButton` between the View and Archive buttons:

```tsx
<Tooltip label="View details">
  <ActionIcon variant="subtle" onClick={onView}>
    <IconEye size={16} />
  </ActionIcon>
</Tooltip>
<CopyAiPromptButton type="bug" report={bug} />
<Tooltip label="Archive">
  <ActionIcon variant="subtle" color="red" onClick={handleArchive}>
    <IconArchive size={16} />
  </ActionIcon>
</Tooltip>
```

**Step 3: Add button to BugDetailModal**

In the `BugDetailModal` component (around line 400-404), add the button to the badge Group:

```tsx
<Group gap="xs">
  <Badge color={getSeverityColor(bug.severity)}>{bug.severity}</Badge>
  <Badge color={getBugStatusColor(bug.status)}>{bug.status}</Badge>
  {bug.ticketNumber && <Badge variant="outline">{bug.ticketNumber}</Badge>}
  <CopyAiPromptButton type="bug" report={bug} />
</Group>
```

**Step 4: Verify the app compiles**

Run: `cd aws-optimizer/apps/web && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add aws-optimizer/apps/web/src/pages/FeedbackAdminPage.tsx
git commit -m "feat(feedback): add copy AI prompt button to bug report card and modal"
```

---

### Task 3: Add CopyAiPromptButton to feedback card and detail modal

**Files:**
- Modify: `aws-optimizer/apps/web/src/pages/FeedbackAdminPage.tsx`

**Step 1: Add button to FeedbackCard**

In the `FeedbackCard` component (around line 365-375), add between View and Archive:

```tsx
<Tooltip label="View details">
  <ActionIcon variant="subtle" onClick={onView}>
    <IconEye size={16} />
  </ActionIcon>
</Tooltip>
<CopyAiPromptButton type="feedback" report={feedback} />
<Tooltip label="Archive">
  <ActionIcon variant="subtle" color="red" onClick={handleArchive}>
    <IconArchive size={16} />
  </ActionIcon>
</Tooltip>
```

**Step 2: Add button to FeedbackDetailModal**

In the `FeedbackDetailModal` component (around line 499-509), add to the badge Group:

```tsx
<Group gap="xs">
  <Badge color={getFeedbackTypeColor(feedback.type)}>
    {getFeedbackTypeLabel(feedback.type)}
  </Badge>
  <Badge color={getPriorityColor(feedback.priority)}>
    {getPriorityLabel(feedback.priority)}
  </Badge>
  <Badge color={getFeedbackStatusColor(feedback.status)}>
    {getFeedbackStatusLabel(feedback.status)}
  </Badge>
  {feedback.ticketNumber && <Badge variant="outline">{feedback.ticketNumber}</Badge>}
  <CopyAiPromptButton type="feedback" report={feedback} />
</Group>
```

**Step 3: Verify the app compiles**

Run: `cd aws-optimizer/apps/web && npx tsc --noEmit`
Expected: No errors

**Step 4: Run the full test suite**

Run: `cd aws-optimizer/apps/web && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add aws-optimizer/apps/web/src/pages/FeedbackAdminPage.tsx
git commit -m "feat(feedback): add copy AI prompt button to feedback card and modal"
```
