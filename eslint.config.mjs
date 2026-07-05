import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "public/excalidraw-assets/**",
      "next-env.d.ts",
      // Tauri native build artifacts (generated; not source).
      "src-tauri/target/**",
      "src-tauri/gen/**",
    ],
  },
  // PR 0.2 — structural guardrails (warn-first).
  // These surface oversized files / functions and high-complexity code so
  // later phases (CSS split, god-component dedup) have a CI-visible target
  // list. Kept at `warn` so CI stays green while known offenders still
  // exist; ratcheted to `error` in PR 3.4 once they are resolved.
  //
  // NOTE: `import/order` was intentionally left out — eslint-config-next's
  // bundled TypeScript import resolver throws "invalid interface loaded as
  // resolver" under ESLint 9 flat config, flooding the run with hundreds of
  // spurious resolver-error warnings. It can return in a dedicated follow-up
  // wired through eslint-plugin-import-x.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ["warn", 15],
    },
  },
  // Test files legitimately contain long `describe`/setup blocks; relax the
  // size caps there so the structural signal stays focused on shipped source.
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
];

export default eslintConfig;
