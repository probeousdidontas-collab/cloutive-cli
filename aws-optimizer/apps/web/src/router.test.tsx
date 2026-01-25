import { describe, test, expect } from "vitest";
import { router } from "./router";

describe("TanStack Router Configuration", () => {
  test("should export router instance", () => {
    expect(router).toBeDefined();
  });

  test("should have route tree configured", () => {
    expect(router.routeTree).toBeDefined();
  });

  test("router should have navigate method", () => {
    expect(typeof router.navigate).toBe("function");
  });

  test("router should have load method", () => {
    expect(typeof router.load).toBe("function");
  });
});
