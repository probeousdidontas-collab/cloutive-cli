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
