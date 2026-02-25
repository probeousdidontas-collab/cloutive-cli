#!/usr/bin/env node

/**
 * Static analysis script to verify all Convex functions referenced in the frontend
 * are actually defined in the backend source files.
 *
 * Usage:
 *   node scripts/check-convex-sync.mjs            # Static check only
 *   node scripts/check-convex-sync.mjs --deployed  # Also check deployed functions
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Mismatches found
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONVEX_DIR = path.join(ROOT, "packages/convex/convex");
const WEB_SRC_DIR = path.join(ROOT, "apps/web/src");

const checkDeployed = process.argv.includes("--deployed");

// ─── Colors ────────────────────────────────────────────────────────────────
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// ─── 1. Scan Convex backend for function definitions ───────────────────────

/** Recursively find all .ts files, excluding _generated and node_modules */
function findTsFiles(dir, base = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_generated" || entry.name === "node_modules") continue;
      results.push(...findTsFiles(full, base));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

/** Extract exported Convex functions from a file */
function extractFunctions(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const functions = [];

  // Match: export const NAME = query/mutation/action/internalQuery/internalMutation/internalAction(
  const pattern =
    /export\s+const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\s*\(/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split("\n").length;
    functions.push({
      name: match[1],
      type: match[2],
      isInternal: match[2].startsWith("internal"),
      line: lineNum,
    });
  }
  return functions;
}

/** Get the module name from a file path (relative to convex dir, no extension) */
function getModuleName(filePath) {
  const rel = path.relative(CONVEX_DIR, filePath);
  return rel.replace(/\.ts$/, "").replace(/\\/g, "/");
}

// Build the map of all defined functions
const definedFunctions = new Map(); // "module.function" -> { type, isInternal, file, line }
const moduleMap = new Map(); // "module" -> [functions]

const convexFiles = findTsFiles(CONVEX_DIR);
for (const file of convexFiles) {
  const moduleName = getModuleName(file);
  const functions = extractFunctions(file);

  if (functions.length > 0) {
    moduleMap.set(moduleName, functions);
    for (const fn of functions) {
      // For "ai/chat" module, the api reference would be "ai.chat.functionName"
      const apiPath = moduleName.replace(/\//g, ".") + "." + fn.name;
      definedFunctions.set(apiPath, {
        ...fn,
        module: moduleName,
        file: path.relative(ROOT, file),
      });
    }
  }
}

// ─── 2. Scan frontend for api.* references ─────────────────────────────────

function findFrontendFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      results.push(...findFrontendFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Extract api.module.function references from frontend code */
function extractApiReferences(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const refs = [];

  // Match api.xxx.yyy or api.xxx.yyy.zzz (for nested modules like ai/chat -> api.ai.chat.func)
  // Excludes comments (basic heuristic: skip lines starting with // or *)
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comment-only lines
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    // Remove inline comments before matching
    const codePart = line.replace(/\/\/.*$/, "");

    // Match api.xxx.yyy patterns - capture the full dotted path after "api."
    const pattern = /\bapi\.([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+)/g;
    let match;
    while ((match = pattern.exec(codePart)) !== null) {
      const fullPath = match[1]; // e.g., "cronManager.listSchedules" or "ai.chat.sendMessage"
      refs.push({
        path: fullPath,
        line: i + 1,
        raw: match[0],
      });
    }
  }
  return refs;
}

const frontendRefs = new Map(); // "module.function" -> [{ file, line }]

const webFiles = findFrontendFiles(WEB_SRC_DIR);
for (const file of webFiles) {
  const refs = extractApiReferences(file);
  for (const ref of refs) {
    const key = ref.path;
    if (!frontendRefs.has(key)) {
      frontendRefs.set(key, []);
    }
    frontendRefs.get(key).push({
      file: path.relative(ROOT, file),
      line: ref.line,
    });
  }
}

// ─── 3. Cross-reference ────────────────────────────────────────────────────

const errors = [];
const warnings = [];

// Check: every frontend reference should have a matching backend definition
for (const [apiPath, locations] of frontendRefs) {
  const def = definedFunctions.get(apiPath);
  if (!def) {
    errors.push({
      type: "MISSING_DEFINITION",
      apiPath,
      locations,
    });
  } else if (def.isInternal) {
    errors.push({
      type: "INTERNAL_CALLED_FROM_FRONTEND",
      apiPath,
      locations,
      definition: def,
    });
  }
}

// Check: public functions defined but never referenced from frontend (info only)
const publicFunctions = [...definedFunctions.entries()].filter(
  ([, def]) => !def.isInternal
);
for (const [apiPath, def] of publicFunctions) {
  if (!frontendRefs.has(apiPath)) {
    warnings.push({
      type: "UNREFERENCED",
      apiPath,
      definition: def,
    });
  }
}

// ─── 4. Optional: check deployed functions ─────────────────────────────────

let deployedErrors = [];
if (checkDeployed) {
  try {
    console.log(dim("\nQuerying deployed functions via Convex CLI...\n"));
    const output = execSync("npx convex functions", {
      cwd: path.join(ROOT, "packages/convex"),
      encoding: "utf-8",
      timeout: 30000,
    });

    // Parse the output to get function names
    // Format is typically: module:functionName (query|mutation|action)
    const deployedSet = new Set();
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Try to extract "module:function" pattern
      const match = trimmed.match(/^(\S+):(\S+)/);
      if (match) {
        const mod = match[1].replace(/\//g, ".");
        deployedSet.add(`${mod}.${match[2]}`);
      }
    }

    if (deployedSet.size > 0) {
      // Check each frontend reference against deployed functions
      for (const [apiPath, locations] of frontendRefs) {
        if (!deployedSet.has(apiPath)) {
          const def = definedFunctions.get(apiPath);
          if (def && !def.isInternal) {
            deployedErrors.push({
              type: "NOT_DEPLOYED",
              apiPath,
              locations,
              definition: def,
            });
          }
        }
      }
    } else {
      console.log(yellow("  Could not parse deployed functions output."));
      console.log(dim("  Raw output: " + output.substring(0, 200)));
    }
  } catch (e) {
    console.log(
      yellow("  Could not check deployed functions: " + e.message)
    );
    console.log(dim("  Make sure you're logged in: npx convex login"));
  }
}

// ─── 5. Report ─────────────────────────────────────────────────────────────

console.log(bold("\n═══ Convex Function Sync Check ═══\n"));

// Stats
const totalDefined = definedFunctions.size;
const publicCount = publicFunctions.length;
const internalCount = totalDefined - publicCount;
const totalRefs = frontendRefs.size;

console.log(
  `  Defined functions:  ${cyan(totalDefined)} (${publicCount} public, ${internalCount} internal)`
);
console.log(`  Frontend references: ${cyan(totalRefs)} unique api paths`);
console.log(`  Backend modules:     ${cyan(moduleMap.size)}`);
console.log();

// Errors: missing definitions
const missingDefs = errors.filter((e) => e.type === "MISSING_DEFINITION");
if (missingDefs.length > 0) {
  console.log(
    red(bold(`✗ ${missingDefs.length} function(s) referenced but NOT defined:\n`))
  );
  for (const err of missingDefs) {
    console.log(red(`  ✗ api.${err.apiPath}`));
    for (const loc of err.locations) {
      console.log(dim(`    → ${loc.file}:${loc.line}`));
    }
  }
  console.log();
}

// Errors: internal functions called from frontend
const internalCalls = errors.filter(
  (e) => e.type === "INTERNAL_CALLED_FROM_FRONTEND"
);
if (internalCalls.length > 0) {
  console.log(
    red(
      bold(
        `✗ ${internalCalls.length} internal function(s) referenced from frontend:\n`
      )
    )
  );
  for (const err of internalCalls) {
    console.log(red(`  ✗ api.${err.apiPath} (${err.definition.type})`));
    console.log(
      dim(`    defined: ${err.definition.file}:${err.definition.line}`)
    );
    for (const loc of err.locations) {
      console.log(dim(`    → ${loc.file}:${loc.line}`));
    }
  }
  console.log();
}

// Deployed check errors
if (deployedErrors.length > 0) {
  console.log(
    red(
      bold(
        `✗ ${deployedErrors.length} function(s) defined locally but NOT deployed:\n`
      )
    )
  );
  for (const err of deployedErrors) {
    console.log(red(`  ✗ api.${err.apiPath}`));
    console.log(
      dim(`    defined: ${err.definition.file}:${err.definition.line}`)
    );
    for (const loc of err.locations) {
      console.log(dim(`    → ${loc.file}:${loc.line}`));
    }
  }
  console.log();
  console.log(yellow("  Fix: run `npx convex deploy` in packages/convex/"));
  console.log();
}

// Warnings: unreferenced functions
if (warnings.length > 0) {
  console.log(
    yellow(`⚠ ${warnings.length} public function(s) defined but not referenced from frontend:\n`)
  );
  for (const warn of warnings) {
    console.log(
      yellow(`  ○ api.${warn.apiPath}`) +
        dim(` (${warn.definition.type})`)
    );
    console.log(dim(`    ${warn.definition.file}:${warn.definition.line}`));
  }
  console.log();
  console.log(
    dim(
      "  (This is informational — these may be used by other backends, crons, or internal calls)"
    )
  );
  console.log();
}

// Summary
const hasErrors =
  missingDefs.length > 0 ||
  internalCalls.length > 0 ||
  deployedErrors.length > 0;

if (hasErrors) {
  console.log(red(bold("FAIL")) + " — Convex function sync issues found.");
  process.exit(1);
} else {
  console.log(
    green(bold("PASS")) +
      " — All frontend api references match backend definitions."
  );
  process.exit(0);
}
