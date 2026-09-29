import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "agent-evals": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/bin/**"],
      reporter: ["text", "json-summary"],
      thresholds: { statements: 95, branches: 85, functions: 95, lines: 95 },
    },
  },
});
