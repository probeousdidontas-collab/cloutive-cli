# AI Prompt Management UI — Design Spec

## Overview

Add a prompt management page to aws-optimizer web UI where admins can view, edit, and version-control the AI prompts used for report generation. Organizations can override system defaults with their own customizations.

## Requirements

- All 6 AI prompts (5 report types + cost analysis insights) visible and editable in UI
- Structured form editing — each prompt split into logical sections with a freeform suffix
- Admin can edit system defaults and create new report types
- Org users can create overrides on top of system defaults
- Full version control: history, side-by-side diff, restore to any version
- Prompt resolution: org override > system default > hardcoded fallback

## Data Model (Convex Schema)

### `reportPrompts` table

| Field | Type | Description |
|---|---|---|
| type | string | Unique slug: "cost_analysis", "savings_summary", etc. or custom |
| label | string | Human-readable name |
| isSystem | boolean | true = system default, false = org override/custom |
| organizationId | optional Id<"organizations"> | null for system defaults |
| sections | array | Structured prompt sections (see below) |
| freeformSuffix | string | Additional freeform instructions |
| isActive | boolean | Enable/disable toggle |
| createdBy | Id<"users"> | Creator |
| createdAt | number | Creation timestamp |
| updatedAt | number | Last modification timestamp |

**Section structure:**

| Field | Type | Description |
|---|---|---|
| key | string | Unique key within prompt, e.g. "executive_summary_instructions" |
| label | string | Display label in the form |
| value | string | Prompt content |
| fieldType | "textarea" \| "text" \| "select" | Input type in form |
| options | optional array of string | Choices for "select" fieldType (ignored for others) |

**Indexes:**
- `by_type_and_system` — (type, isSystem) — for resolving system defaults
- `by_type_and_org` — (type, organizationId) — for resolving org overrides
- `by_org` — (organizationId) — for listing all org prompts

**Uniqueness enforcement:** Mutations that create prompts must first query `by_type_and_org` (for org overrides) or `by_type_and_system` (for system defaults) and reject if a record already exists. This is a check-then-write within a single mutation, which is atomic in Convex.

### `reportPromptVersions` table

| Field | Type | Description |
|---|---|---|
| promptId | Id<"reportPrompts"> | Parent prompt |
| version | number | Incrementing version number |
| sections | array | Snapshot of sections at this version |
| freeformSuffix | string | Snapshot of freeform suffix |
| changedBy | Id<"users"> | Who made the change |
| changeMessage | optional string | Optional commit-style message |
| createdAt | number | Timestamp |

**Indexes:**
- `by_prompt` — (promptId) — for listing all versions
- `by_prompt_and_version` — (promptId, version) — for fetching specific version

**Pagination:** Version history queries use cursor-based pagination (Convex default), loading 20 versions at a time with "Load more" in the UI.

## Access Control

The project has two role systems:
- **Platform admin:** `users.role == "admin"` — manages system defaults and custom types
- **Org roles:** `orgMembers.role` (owner/admin/member/viewer) — manages org overrides

| Action | Platform Admin | Org Owner/Admin | Org Member | Org Viewer |
|---|---|---|---|---|
| View system defaults | Yes | Yes (read-only) | Yes (read-only) | Yes (read-only) |
| Edit system defaults | Yes | No | No | No |
| Create new report type | Yes | No | No | No |
| Create org override | Yes | Yes | No | No |
| Edit org override | Yes | Yes | No | No |
| Reset to default | Yes | Yes | No | No |
| View version history | Yes | Yes | Yes (own org) | Yes (own org) |

## Prompt Resolution Logic

Implemented as an `internalQuery` so it can be called from actions via `ctx.runQuery()`:

```
// convex/reportPrompts.ts
export const resolvePrompt = internalQuery({
  args: { type: v.string(), organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, { type, organizationId }) => {
    // Step 1: Check org override
    if (organizationId) {
      const override = await ctx.db
        .query("reportPrompts")
        .withIndex("by_type_and_org", q => q.eq("type", type).eq("organizationId", organizationId))
        .filter(q => q.eq(q.field("isActive"), true))
        .first();
      if (override) return override;
    }
    // Step 2: Check system default
    const systemDefault = await ctx.db
      .query("reportPrompts")
      .withIndex("by_type_and_system", q => q.eq("type", type).eq("isSystem", true))
      .filter(q => q.eq(q.field("isActive"), true))
      .first();
    if (systemDefault) return systemDefault;
    // Step 3: Return null → caller falls back to hardcoded
    return null;
  },
});
```

## Page Structure

### Route: `/settings/prompts`

Navigation: Settings group → "AI Prompts" item (icon: IconRobot)

### Layout: Master-Detail

**Left Panel (~300px):**
- "System Defaults" group — 6 built-in prompts (5 report types + cost_analysis_insights)
- "Custom Types" group — admin-created types
- Each item shows: label, type icon, "Customized" badge if org override exists
- "+ New Report Type" button at bottom (platform admin only)

**Right Panel (remaining width):**
- Header: prompt label, status badge (System Default / Org Override / Custom)
- Form body: structured sections
  - Each section: label + input (textarea/text/select based on fieldType)
  - For "select" fieldType, options rendered from section's `options` array
  - Sections are collapsible via Mantine Accordion
- "Additional Instructions" freeform textarea below sections
- Footer actions: "Save", "Reset to Default" (for overrides), "View History"
- Inactive prompts show a "This prompt is inactive" banner with "Activate" button

### "Reset to Default" Behavior

Deletes the org override record entirely, which:
- Removes all org-specific version history for that prompt
- Resolution falls back to system default
- Confirmation dialog warns: "This will remove your customization and all version history for this prompt"

## Version Control

### History Drawer

Opens from "View History" button. Right-side Mantine Drawer containing:

- Header: prompt label + total version count
- Version list: cards with version number, user, date, change message
- Per-card actions: "View", "Compare", "Restore"
- Paginated: loads 20 at a time with "Load more" button

### Diff View

Triggered by "Compare" or selecting two versions:

- Side-by-side layout using Mantine Grid
- Left = old version, right = new version
- Diff is computed per-section: each section's `value` string is diffed line-by-line using the `diff` package
- Added/removed sections shown as fully green/red blocks
- Changed lines highlighted with `var(--mantine-color-green-light)` / `var(--mantine-color-red-light)`
- Unchanged sections collapsed by default
- `freeformSuffix` diffed as its own section at the bottom

### Restore

- "Restore this version" → confirmation dialog
- Creates a new version (non-destructive), change message auto-set to "Restored from vN"

### Save Flow

1. User edits form
2. Click "Save" → modal with optional change message
3. Backend mutation: update `reportPrompts` fields + insert new `reportPromptVersions` row (atomic)
4. First save auto-creates v1
5. UI updates via Convex real-time subscription (no optimistic updates needed — Convex handles reactivity)

## Integration with Existing System

### `buildReportPrompt()` Refactor

Current: hardcoded prompt strings in `reportGeneration.ts` (pure function inside `internalAction`)
After: calls `resolvePrompt` internalQuery via `ctx.runQuery()`, falls back to legacy function

```
// Inside generateReport internalAction:
const prompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
  type: reportType,
  organizationId: orgId,
});
const promptText = prompt
  ? assembleSections(prompt.sections, prompt.freeformSuffix)
  : legacyBuildReportPrompt(reportType, accounts, orgId);
```

The existing `buildReportPrompt()` is preserved as `legacyBuildReportPrompt()` for fallback.

### `costAnalysisInsights.ts` Refactor

Current: inline prompt string passed to `generateText()` inside `internalAction`
After: same pattern — calls `resolvePrompt` with type `"cost_analysis_insights"` via `ctx.runQuery()`

```
// Inside generateInsights internalAction:
const prompt = await ctx.runQuery(internal.reportPrompts.resolvePrompt, {
  type: "cost_analysis_insights",
  organizationId: orgId,
});
const systemPrompt = prompt
  ? assembleSections(prompt.sections, prompt.freeformSuffix)
  : LEGACY_INSIGHTS_PROMPT; // current hardcoded string
```

### Custom Report Types and the `reports` Table

The existing `reports.type` field uses a closed validator of 5 types. Custom prompt types created by admins do NOT add new report types to this table. Instead:
- Custom prompts are used as alternative instructions for the existing 5 report types
- When generating a report, the user selects a report type (from the existing 5) AND optionally a custom prompt template
- This avoids schema migration for the `reports` table

### Seed Data

Implemented as an idempotent Convex migration (using the project's existing migration pattern):

1. For each of the 6 prompt types, check if a system default already exists (`by_type_and_system` index)
2. If not → create the record + v1 version entry
3. If exists → skip (idempotent)

**Section decomposition for each prompt type:**

The current monolithic prompt strings are split at their logical boundaries (already marked by comments/headers in the code). Example for `cost_analysis`:

| Section Key | Label | Source |
|---|---|---|
| verification | Account Verification Steps | "Use aws_listAccounts tool first..." block |
| data_collection | Data Collection Instructions | "For each account, use appropriate tools..." block |
| analysis_focus | Analysis Focus Areas | Service Breakdown, Region Breakdown, Trends, Anomalies sections |
| output_format | Output Format | Markdown formatting instructions |
| table_templates | Table Templates | ASCII table templates for services |

Similar decomposition for each prompt type, following the natural structure of each hardcoded prompt.

## Technology Choices

### Frontend
- **State:** MobX store (`PromptStore`)
- **UI:** Mantine components — Textarea, TextInput, Select, Accordion, Drawer, Grid, Modal, Badge
- **Diff:** `diff` npm package + custom side-by-side renderer (per-section `value` diffing)
- **Colors:** All theme-aware CSS variables (no hardcoded color shades)

### Backend (Convex)
- `convex/reportPrompts.ts` — CRUD queries/mutations + `resolvePrompt` internalQuery
- `convex/reportPromptVersions.ts` — version history queries
- `convex/migrations/seedReportPrompts.ts` — idempotent seed migration
- Refactored `buildReportPrompt()` → `legacyBuildReportPrompt()` + `resolvePrompt` call in `reportGeneration.ts`
- Refactored prompt loading in `costAnalysisInsights.ts`

### Testing
- **Unit (convex-testing):** prompt CRUD, version creation, uniqueness enforcement, org override resolution, seed idempotency
- **E2E:** edit prompt → generate report → verify edited prompt was used in output
