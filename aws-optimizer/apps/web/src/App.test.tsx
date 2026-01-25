import { describe, test, expect } from "vitest";
import { App } from "./App";

describe("App Component", () => {
  test("should be a valid React component", () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe("function");
  });

  test("should be exported from App.tsx", async () => {
    const appModule = await import("./App");
    expect(appModule.App).toBeDefined();
  });
});
