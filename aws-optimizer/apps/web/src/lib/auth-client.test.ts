import { describe, test, expect } from "vitest";

describe("Auth Client", () => {
  test("should export authClient", async () => {
    const { authClient } = await import("./auth-client");
    expect(authClient).toBeDefined();
  });

  test("should export signIn method", async () => {
    const { signIn } = await import("./auth-client");
    expect(signIn).toBeDefined();
  });

  test("should export signUp method", async () => {
    const { signUp } = await import("./auth-client");
    expect(signUp).toBeDefined();
  });

  test("should export signOut method", async () => {
    const { signOut } = await import("./auth-client");
    expect(signOut).toBeDefined();
  });

  test("should export useSession hook", async () => {
    const { useSession } = await import("./auth-client");
    expect(useSession).toBeDefined();
    expect(typeof useSession).toBe("function");
  });

  test("should export signInWithEmail helper", async () => {
    const { signInWithEmail } = await import("./auth-client");
    expect(signInWithEmail).toBeDefined();
    expect(typeof signInWithEmail).toBe("function");
  });

  test("should export signUpWithEmail helper", async () => {
    const { signUpWithEmail } = await import("./auth-client");
    expect(signUpWithEmail).toBeDefined();
    expect(typeof signUpWithEmail).toBe("function");
  });

  test("should export forgotPassword helper", async () => {
    const { forgotPassword } = await import("./auth-client");
    expect(forgotPassword).toBeDefined();
    expect(typeof forgotPassword).toBe("function");
  });
});
