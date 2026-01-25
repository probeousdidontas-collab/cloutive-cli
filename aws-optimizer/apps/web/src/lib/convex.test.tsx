import { describe, test, expect } from "vitest";
import { ConvexClientProvider } from "./convex";

describe("ConvexClientProvider", () => {
  test("should export ConvexClientProvider function", () => {
    expect(ConvexClientProvider).toBeDefined();
    expect(typeof ConvexClientProvider).toBe("function");
  });

  test("ConvexClientProvider should be a valid React component", async () => {
    const convexModule = await import("./convex");
    expect(convexModule.ConvexClientProvider).toBeDefined();
  });
});
