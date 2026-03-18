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
| updatedAt | number | Last modification timestamp |

**Section structure:**

| Field | Type | Description |
|---|---|---|
| key | string | Unique key within prompt, e.g. "executive_summary_instructions" |
| label | string | Display label in the form |
| value | string | Prompt content |
| fieldType | "textarea" \| "text" \| "select" | Input type in form |

**Indexes:**
- `by_type` — (type)
- `by_org` — (organizationId)
- `by_type_and_org` — (type, organizationId)

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
- `by_prompt` — (promptId)
- `by_prompt_and_version` — (promptId, version)

## Prompt Resolution Logic

When generating a report for an organization:

1. Query `reportPrompts` where `type == requestedType AND organizationId == orgId AND isActive == true`
2. If found → use org override
3. Else → query `reportPrompts` where `type == requestedType AND isSystem == true AND isActive == true`
4. If found → use system default
5. Else → fall back to current hardcoded prompts (safety net during migration)

## Page Structure

### Route: `/settings/prompts`

Navigation: Settings group → "AI Prompts" item (icon: IconRobot)

### Layout: Master-Detail

**Left Panel (~300px):**
- "System Defaults" group — 6 built-in prompts (5 report types + cost_analysis_insights)
- "Custom Types" group — admin-created types
- Each item shows: label, type icon, "Customized" badge if org override exists
- "+ New Report Type" button at bottom (admin only)

**Right Panel (remaining width):**
- Header: prompt label, status badge (System Default / Org Override / Custom)
- Form body: structured sections
  - Each section: label + input (textarea/text/select based on fieldType)
  - Sections are collapsible via Mantine Accordion
- "Additional Instructions" freeform textarea below sections
- Footer actions: "Save", "Reset to Default" (for overrides), "View History"

### Access Control

| Action | Admin | Org User |
|---|---|---|
| View system defaults | Yes | Yes (read-only) |
| Edit system defaults | Yes | No |
| Create new report type | Yes | No |
| Create org override | Yes | Yes |
| Edit org override | Yes | Yes |
| Reset to default | Yes | Yes |
| View version history | Yes | Yes (own org) |

## Version Control

### History Drawer

Opens from "View History" button. Right-side Mantine Drawer containing:

- Header: prompt label + total version count
- Version list: cards with version number, user, date, change message
- Per-card actions: "View", "Compare", "Restore"

### Diff View

Triggered by "Compare" or selecting two versions:

- Side-by-side layout using Mantine Grid
- Left = old version, right = new version
- Changed lines highlighted with green (added) / red (removed) using CSS variables
- Section-based diff — unchanged sections collapsed
- Uses `diff` npm package for text comparison

### Restore

- "Restore this version" → confirmation dialog
- Creates a new version (non-destructive), change message auto-set to "Restored from vN"

### Save Flow

1. User edits form
2. Click "Save" → modal with optional change message
3. Backend: update `reportPrompts` + insert new `reportPromptVersions` row
4. First save auto-creates v1

## Integration with Existing System

### `buildReportPrompt()` Refactor

Current: hardcoded prompt strings in `reportGeneration.ts`
After: reads from `reportPrompts` table, assembles sections into final prompt string

```
async function buildReportPrompt(ctx, type, orgId):
  prompt = await resolvePrompt(ctx, type, orgId)  // resolution logic above
  if (!prompt) return legacyBuildReportPrompt(type) // fallback
  return assembleSections(prompt.sections, prompt.freeformSuffix)
```

### `costAnalysisInsights.ts` Integration

The hardcoded prompt in this file becomes the "cost_analysis_insights" system prompt record.

Sections derived from current prompt:
- "Role Definition" — "You are an AWS cost optimization expert..."
- "Executive Summary Instructions" — org-level insight generation rules
- "Account Commentary Rules" — per-account commentary criteria (>$100 or >10% change)

### Seed Data

On first deploy, a seed function creates 6 `reportPrompts` records with `isSystem: true`:

1. `cost_analysis` — sections from current buildReportPrompt cost_analysis case
2. `savings_summary` — sections from savings_summary case
3. `resource_inventory` — sections from resource_inventory case
4. `recommendation_summary` — sections from recommendation_summary case
5. `executive_summary` — sections from executive_summary case
6. `cost_analysis_insights` — sections from costAnalysisInsights.ts prompt

Each prompt's initial state also becomes v1 in `reportPromptVersions`.

## Technology Choices

### Frontend
- **State:** MobX store (`PromptStore`)
- **UI:** Mantine components — Textarea, TextInput, Select, Accordion, Drawer, Grid, Modal, Badge
- **Diff:** `diff` npm package + custom side-by-side renderer
- **Colors:** All theme-aware CSS variables (no hardcoded color shades)

### Backend (Convex)
- `convex/reportPrompts.ts` — CRUD queries and mutations
- `convex/reportPromptVersions.ts` — version history queries
- `convex/seed/reportPromptsSeed.ts` — initial data migration
- Refactored `buildReportPrompt()` in `reportGeneration.ts`
- Refactored prompt loading in `costAnalysisInsights.ts`

### Testing
- **Unit (convex-testing):** prompt CRUD, version creation, org override resolution, seed correctness
- **E2E:** edit prompt → generate report → verify edited prompt was used in output
