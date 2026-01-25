import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".wrangler"],
    testTimeout: 30000, // Increased for deployment tests
  },
});
