import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: { "@/": new URL("./", import.meta.url).pathname },
    environment: "node",
    testTimeout: 15000,
    // .tsx was silently skipped before; include it so component tests run.
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Gate scoped to the tested core; components/app (~untested) join later
      // phases so the threshold stays meaningful instead of dragged toward 0.
      include: ["lib/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
      // Floor = measured baseline − ~1pt; a regression ratchet raised as tests grow.
      thresholds: {
        statements: 80,
        branches: 69,
        functions: 84,
        lines: 83,
      },
    },
  },
});
