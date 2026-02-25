/**
 * Cron Expression Utilities
 *
 * Pure functions for parsing, validating, and computing next run times
 * for standard 5-field cron expressions.
 *
 * Supports: *, numbers, step values (N), comma-separated lists.
 * Fields: minute hour dayOfMonth month dayOfWeek
 */

export interface ParsedCron {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Expand a single cron field into an array of matching values.
 * Supports: "*", "N", "* /N" (step), comma-separated lists, ranges "N-M".
 */
function expandField(field: string, min: number, max: number): number[] {
  const values: Set<number> = new Set();

  for (const part of field.split(",")) {
    const trimmed = part.trim();

    if (trimmed.includes("/")) {
      // Step value: */N or N-M/N
      const [range, stepStr] = trimmed.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) continue;

      let start = min;
      let end = max;
      if (range !== "*") {
        if (range.includes("-")) {
          const [rs, re] = range.split("-");
          start = parseInt(rs, 10);
          end = parseInt(re, 10);
        } else {
          start = parseInt(range, 10);
        }
      }
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (trimmed === "*") {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    } else if (trimmed.includes("-")) {
      // Range: N-M
      const [rs, re] = trimmed.split("-");
      const start = parseInt(rs, 10);
      const end = parseInt(re, 10);
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
    } else {
      const val = parseInt(trimmed, 10);
      if (!isNaN(val)) values.add(val);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * Parse a 5-field cron expression into expanded value arrays.
 */
export function parseCronExpression(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minute: expandField(parts[0], 0, 59),
    hour: expandField(parts[1], 0, 23),
    dayOfMonth: expandField(parts[2], 1, 31),
    month: expandField(parts[3], 1, 12),
    dayOfWeek: expandField(parts[4], 0, 6), // 0 = Sunday
  };
}

/**
 * Validate a cron expression. Returns an error message string, or null if valid.
 */
export function validateCronExpression(expr: string): string | null {
  if (!expr || typeof expr !== "string") {
    return "Cron expression is required";
  }

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return `Expected 5 fields (minute hour dayOfMonth month dayOfWeek), got ${parts.length}`;
  }

  const fieldDefs: Array<{ name: string; min: number; max: number }> = [
    { name: "minute", min: 0, max: 59 },
    { name: "hour", min: 0, max: 23 },
    { name: "dayOfMonth", min: 1, max: 31 },
    { name: "month", min: 1, max: 12 },
    { name: "dayOfWeek", min: 0, max: 6 },
  ];

  for (let i = 0; i < 5; i++) {
    const field = parts[i];
    const def = fieldDefs[i];

    // Validate each comma-separated part
    for (const part of field.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) return `Empty value in ${def.name} field`;

      if (trimmed.includes("/")) {
        const [range, stepStr] = trimmed.split("/");
        const step = parseInt(stepStr, 10);
        if (isNaN(step) || step <= 0) {
          return `Invalid step value "${stepStr}" in ${def.name} field`;
        }
        if (range !== "*" && !range.includes("-")) {
          const val = parseInt(range, 10);
          if (isNaN(val) || val < def.min || val > def.max) {
            return `Value ${range} out of range (${def.min}-${def.max}) in ${def.name} field`;
          }
        }
      } else if (trimmed === "*") {
        // valid
      } else if (trimmed.includes("-")) {
        const [rs, re] = trimmed.split("-");
        const start = parseInt(rs, 10);
        const end = parseInt(re, 10);
        if (isNaN(start) || isNaN(end)) {
          return `Invalid range "${trimmed}" in ${def.name} field`;
        }
        if (start < def.min || end > def.max || start > end) {
          return `Range ${start}-${end} invalid for ${def.name} (${def.min}-${def.max})`;
        }
      } else {
        const val = parseInt(trimmed, 10);
        if (isNaN(val) || val < def.min || val > def.max) {
          return `Value "${trimmed}" out of range (${def.min}-${def.max}) in ${def.name} field`;
        }
      }
    }
  }

  return null;
}

/**
 * Compute the next run time after a given timestamp for a cron expression.
 * Returns a UTC millisecond timestamp.
 */
export function getNextRunTime(expr: string, afterMs: number): number {
  const parsed = parseCronExpression(expr);
  const date = new Date(afterMs);

  // Start from the next minute
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(date.getUTCMinutes() + 1);

  // Search up to 2 years ahead to find the next match
  const maxIterations = 366 * 24 * 60; // ~1 year of minutes
  for (let i = 0; i < maxIterations; i++) {
    const month = date.getUTCMonth() + 1; // 1-12
    const dayOfMonth = date.getUTCDate();
    const dayOfWeek = date.getUTCDay(); // 0=Sun
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();

    if (
      parsed.month.includes(month) &&
      parsed.dayOfMonth.includes(dayOfMonth) &&
      parsed.dayOfWeek.includes(dayOfWeek) &&
      parsed.hour.includes(hour) &&
      parsed.minute.includes(minute)
    ) {
      return date.getTime();
    }

    // Advance by 1 minute
    date.setUTCMinutes(date.getUTCMinutes() + 1);
  }

  // Fallback: return afterMs + 24h if no match found
  return afterMs + 24 * 60 * 60 * 1000;
}

/**
 * Check if a cron expression is due to fire within a tick window.
 * Returns true if the job should run.
 */
export function isDue(
  expr: string,
  nowMs: number,
  lastRunAt: number | undefined,
  tickIntervalMs: number
): boolean {
  const nextRun = lastRunAt
    ? getNextRunTime(expr, lastRunAt)
    : getNextRunTime(expr, nowMs - tickIntervalMs);

  return nextRun <= nowMs;
}

// Convert a cron expression to a human-readable string.
// Examples:
//   "0 2 * * *"   -> "Every day at 2:00 AM UTC"
//   "*/5 * * * *" -> "Every 5 minutes"
//   "0 8 * * 1"   -> "Every Monday at 8:00 AM UTC"
//   "0 0 1 * *"   -> "1st of every month at 12:00 AM UTC"
export function cronToHuman(expr: string): string {
  const error = validateCronExpression(expr);
  if (error) return expr;

  const parts = expr.trim().split(/\s+/);
  const [minuteField, hourField, domField, monthField, dowField] = parts;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Every N minutes
  if (minuteField.startsWith("*/") && hourField === "*" && domField === "*" && monthField === "*" && dowField === "*") {
    const step = minuteField.split("/")[1];
    return `Every ${step} minutes`;
  }

  // Every minute
  if (minuteField === "*" && hourField === "*" && domField === "*" && monthField === "*" && dowField === "*") {
    return "Every minute";
  }

  // Build time string
  let timeStr = "";
  if (minuteField !== "*" && hourField !== "*") {
    const hour = parseInt(hourField, 10);
    const minute = parseInt(minuteField, 10);
    if (!isNaN(hour) && !isNaN(minute)) {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${period} UTC`;
    }
  }

  // Every N hours
  if (hourField.startsWith("*/") && domField === "*" && monthField === "*" && dowField === "*") {
    const step = hourField.split("/")[1];
    return minuteField === "0" ? `Every ${step} hours` : `Every ${step} hours at minute ${minuteField}`;
  }

  // Specific day of week
  if (domField === "*" && monthField === "*" && dowField !== "*" && !dowField.includes(",") && !dowField.includes("-") && !dowField.includes("/")) {
    const dow = parseInt(dowField, 10);
    if (!isNaN(dow) && dow >= 0 && dow <= 6) {
      return timeStr ? `Every ${dayNames[dow]} at ${timeStr}` : `Every ${dayNames[dow]}`;
    }
  }

  // Specific day of month
  if (domField !== "*" && !domField.includes(",") && !domField.includes("-") && !domField.includes("/") && monthField === "*" && dowField === "*") {
    const dom = parseInt(domField, 10);
    if (!isNaN(dom)) {
      const suffix = dom === 1 ? "st" : dom === 2 ? "nd" : dom === 3 ? "rd" : "th";
      return timeStr ? `${dom}${suffix} of every month at ${timeStr}` : `${dom}${suffix} of every month`;
    }
  }

  // Specific month + day
  if (domField !== "*" && monthField !== "*" && dowField === "*") {
    const dom = parseInt(domField, 10);
    const month = parseInt(monthField, 10);
    if (!isNaN(dom) && !isNaN(month) && month >= 1 && month <= 12) {
      return timeStr
        ? `${monthNames[month]} ${dom} at ${timeStr}`
        : `${monthNames[month]} ${dom}`;
    }
  }

  // Daily at specific time
  if (domField === "*" && monthField === "*" && dowField === "*" && timeStr) {
    return `Every day at ${timeStr}`;
  }

  return expr;
}
