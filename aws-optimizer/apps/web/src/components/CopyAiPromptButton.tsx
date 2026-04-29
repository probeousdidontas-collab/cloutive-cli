import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { showSuccessToast } from "../lib/notifications";
import {
  buildBugReportPrompt,
  buildFeedbackPrompt,
  type BugReport,
  type FeedbackItem,
} from "../lib/aiPrompts";

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
