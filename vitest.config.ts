import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "test/scripts/**/*.test.ts",
      "test/database/**/*.test.ts",
      "test/api/**/*.test.ts",
      "test/integration/**/*.test.ts",
      "test/security/**/*.test.ts",
    ],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
