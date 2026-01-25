import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
    exclude: ["node_modules", "dist", "convex/_generated"],
    testTimeout: 10000,
  },
});
