import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import schema from "./convex/schema";

// Re-export vitest functions for convenience
export { expect, test, describe, beforeEach, afterEach, vi };

// Import modules using glob pattern for convex-test
// This loads all Convex function files for testing including _generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules = (import.meta as any).glob("./convex/**/*.ts");

/**
 * Test context type for convex-test callbacks.
 * Used in t.run() callbacks for proper typing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TestCtx = any;

/**
 * Create a test Convex instance.
 * Uses the main schema for testing.
 * 
 * Usage:
 * ```ts
 * const t = createTestConvex();
 * 
 * // For mutations/queries using string-based references:
 * await t.mutation("moduleName:functionName", { arg: value });
 * await t.query("moduleName:functionName", { arg: value });
 * 
 * // For direct database access in t.run():
 * await t.run(async (ctx: TestCtx) => {
 *   return await ctx.db.get(id);
 * });
 * ```
 */
export function createTestConvex() {
  return convexTest(schema, modules);
}

// Type exports for test utilities
export type TestConvex = ReturnType<typeof createTestConvex>;

// Export schema and modules for direct use in tests
export { schema, modules };
