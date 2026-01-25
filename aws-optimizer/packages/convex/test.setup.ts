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
 * Create a test Convex instance.
 * Uses the main schema for testing.
 */
export function createTestConvex() {
  return convexTest(schema, modules);
}

// Type exports for test utilities
export type TestConvex = ReturnType<typeof createTestConvex>;

// Export schema and modules for direct use in tests
export { schema, modules };
