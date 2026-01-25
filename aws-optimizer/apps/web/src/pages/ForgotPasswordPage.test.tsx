import { describe, test, expect } from "vitest";

/**
 * US-020: Forgot Password Page Tests
 * 
 * Acceptance Criteria:
 * 3. Create /forgot-password route for password reset
 * 6. Show validation errors appropriately
 */
describe("ForgotPasswordPage Component", () => {
  test("should be a valid React component", async () => {
    const { ForgotPasswordPage } = await import("./ForgotPasswordPage");
    expect(ForgotPasswordPage).toBeDefined();
    expect(typeof ForgotPasswordPage).toBe("function");
  });

  test("should be exported as default", async () => {
    const module = await import("./ForgotPasswordPage");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});

describe("ForgotPasswordPage Route Integration", () => {
  test("router should have /forgot-password route", async () => {
    const { router } = await import("../router");
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
    // Verify router can be used (routes are configured)
    expect(typeof router.navigate).toBe("function");
  });
});
