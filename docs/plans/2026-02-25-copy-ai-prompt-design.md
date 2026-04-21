# Copy AI Prompt for Feedback/Bug Reports

## Problem

Admins viewing bug reports and feedback on the FeedbackAdminPage need a quick way to copy a structured AI prompt that they can paste into a coding AI to implement fixes or features.

## Solution

A shared `CopyAiPromptButton` component that builds type-specific prompts and copies them to clipboard.

## Prompt Templates

### Bug Report

```
Fix the following bug in the codebase:

**Bug:** {title}
**Ticket:** {ticketNumber}
**Severity:** {severity}
**Status:** {status}
**Description:** {description}
**URL:** {url}
**Browser:** {browserInfo}
**Console Errors:** {consoleErrors}

**AI Summary:** {aiSummary}
**Root Cause Analysis:** {aiRootCauseAnalysis}
**Suggested Fix:** {aiSuggestedFix}
```

Fields without values are omitted from the output.

### Feedback (feature_request / change_request / general)

```
Implement the following {type label} in the codebase:

**Request:** {title}
**Ticket:** {ticketNumber}
**Priority:** {priority}
**Status:** {status}
**Description:** {description}
**URL:** {url}

**AI Summary:** {aiSummary}
**Impact Analysis:** {aiImpactAnalysis}
**Action Items:**
- {item1}
- {item2}
```

Fields without values are omitted from the output.

## Component: CopyAiPromptButton

- Accepts either `BugReport` or `FeedbackItem` via a discriminated prop
- Builds prompt text using the appropriate template
- Uses Mantine `CopyButton` for clipboard access
- Icon swaps from `IconCopy` to `IconCheck` on success
- Shows `showSuccessToast("AI prompt copied to clipboard")`
- Tooltip: "Copy AI prompt"

## Placement

1. **BugReportCard** — ActionIcon next to View and Archive buttons
2. **FeedbackCard** — ActionIcon next to View and Archive buttons
3. **BugDetailModal** — Button next to the badge row at top
4. **FeedbackDetailModal** — Button next to the badge row at top

## File Changes

- **New:** `src/components/CopyAiPromptButton.tsx`
- **Modified:** `src/pages/FeedbackAdminPage.tsx` (import + 4 placements)

## Dependencies

- `@mantine/core` (CopyButton, ActionIcon, Tooltip) — already in project
- `@tabler/icons-react` (IconCopy, IconCheck) — already in project
- `../lib/notifications` (showSuccessToast) — already in project
