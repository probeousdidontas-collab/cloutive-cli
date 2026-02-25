# UI Guide — AWS Optimizer Web Frontend

## Mantine Dark Mode — Color Rules

This app uses Mantine v8 with dark mode support. **Never use hardcoded color shades** that only look correct in one theme.

### Backgrounds

| Don't | Do | When |
|---|---|---|
| `bg="gray.0"`, `bg="gray.1"` | `bg="var(--mantine-color-default-hover)"` | Subtle neutral surface (cards, content panels) |
| `bg="red.0"` | `bg="var(--mantine-color-red-light)"` | Error / danger tinted surface |
| `bg="blue.0"` | `bg="var(--mantine-color-blue-light)"` | Info / suggestion tinted surface |
| `bg="green.0"` | `bg="var(--mantine-color-green-light)"` | Success tinted surface |
| `bg="yellow.0"` | `bg="var(--mantine-color-yellow-light)"` | Warning tinted surface |
| `bg="orange.0"` | `bg="var(--mantine-color-orange-light)"` | Attention tinted surface |

The `var(--mantine-color-{color}-light)` tokens resolve to a subtle tint that works in both light and dark themes.

### Text Colors

| Don't | Do | Why |
|---|---|---|
| `c="red.7"`, `c="red.9"` | `c="red"` | Mantine picks the correct shade for the active theme |
| `c="blue.7"`, `c="blue.9"` | `c="blue"` | Same — auto-resolves |
| `c="green.8"` | `c="green"` | Same — auto-resolves |
| `c="orange.7"` | `c="orange"` | Same — auto-resolves |
| `c="yellow.8"` | `c="yellow"` | Same — auto-resolves |

Using just `c="red"` lets Mantine resolve to the right shade (e.g., `red.6` in dark mode, `red.7` in light mode).

### Borders

| Don't | Do |
|---|---|
| `var(--mantine-color-gray-3)` | `var(--mantine-color-default-border)` |
| `borderColor: "var(--mantine-color-red-3)"` | `borderColor: "var(--mantine-color-red-outline)"` |

### Safe Exceptions

- `bg="dark.9"` for always-dark surfaces (terminal output, console errors) — this is intentional
- `c="red.4"` on a `bg="dark.9"` surface — intentionally lighter text on a forced-dark background
- PDF components (`CostAnalysisReportPdf.tsx`, `ReportPdfDocument.tsx`, `pdf/*.tsx`) can use hex colors since PDFs are static documents, not rendered in the browser UI

### Quick Reference: Mantine Theme-Aware CSS Variables

```
--mantine-color-default-hover        Subtle neutral background
--mantine-color-default-border       Default border color
--mantine-color-{color}-light        Tinted background (red, blue, green, etc.)
--mantine-color-{color}-outline      Tinted border color
--mantine-color-dimmed               Secondary text color
--mantine-color-text                 Primary text color
--mantine-color-body                 Page background
```

## Component Patterns

### Stat Cards
```tsx
<Paper p="md" withBorder radius="md">
  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Label</Text>
  <Text size="xl" fw={700}>Value</Text>
</Paper>
```

### Content Panels (AI summaries, info boxes)
```tsx
<Paper p="sm" withBorder bg="var(--mantine-color-default-hover)">
  <Text size="sm">{content}</Text>
</Paper>
```

### Colored Alert Surfaces
```tsx
{/* Error */}
<Paper p="sm" withBorder bg="var(--mantine-color-red-light)">
  <Text c="red">Error message</Text>
</Paper>

{/* Success */}
<Paper p="sm" withBorder bg="var(--mantine-color-green-light)">
  <Text c="green">Success message</Text>
</Paper>
```

### Action Icons with Tooltips
```tsx
<Tooltip label="Action name">
  <ActionIcon variant="subtle" color="blue" onClick={handler}>
    <IconName size={16} />
  </ActionIcon>
</Tooltip>
```

### Badges
```tsx
<Badge size="xs" color={dynamicColor}>{label}</Badge>           {/* Filled */}
<Badge size="xs" color={dynamicColor} variant="outline">{label}</Badge>  {/* Outline */}
<Badge size="xs" color={dynamicColor} variant="light">{label}</Badge>    {/* Light */}
```

## Icon Library

We use `@tabler/icons-react`. Always import only what you need:

```tsx
import { IconClock, IconEdit, IconTrash } from "@tabler/icons-react";
```

Standard sizes: `16` for inline/action icons, `20` for nav/header icons, `24`+ for hero/empty states.
