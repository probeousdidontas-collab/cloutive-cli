import { describe, test, expect } from "vitest";
import { theme, TOUCH_TARGET_SIZE } from "./theme";

describe("Mantine Theme Configuration", () => {
  test("should have awsOrange as primary color", () => {
    expect(theme.primaryColor).toBe("awsOrange");
  });

  test("should include awsOrange color palette", () => {
    expect(theme.colors?.awsOrange).toBeDefined();
    expect(theme.colors?.awsOrange).toHaveLength(10);
  });

  test("should include deepBlue color palette", () => {
    expect(theme.colors?.deepBlue).toBeDefined();
    expect(theme.colors?.deepBlue).toHaveLength(10);
  });

  test("should have system font family", () => {
    expect(theme.fontFamily).toContain("-apple-system");
    expect(theme.fontFamily).toContain("BlinkMacSystemFont");
  });

  test("should have medium default radius", () => {
    expect(theme.defaultRadius).toBe("md");
  });

  test("should export TOUCH_TARGET_SIZE constant", () => {
    expect(TOUCH_TARGET_SIZE).toBe(44);
  });

  test("should configure Button component with touch target size", () => {
    expect(theme.components?.Button).toBeDefined();
    expect(theme.components?.Button?.defaultProps?.size).toBe("md");
  });

  test("should configure TextInput component with touch target size", () => {
    expect(theme.components?.TextInput).toBeDefined();
    expect(theme.components?.TextInput?.defaultProps?.size).toBe("md");
  });

  test("should configure Select component with touch target size", () => {
    expect(theme.components?.Select).toBeDefined();
    expect(theme.components?.Select?.defaultProps?.size).toBe("md");
  });

  test("should configure ActionIcon component with large size", () => {
    expect(theme.components?.ActionIcon).toBeDefined();
    expect(theme.components?.ActionIcon?.defaultProps?.size).toBe("lg");
  });
});
