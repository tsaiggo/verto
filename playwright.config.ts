import { defineConfig } from "playwright/test";

const port = 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  reporter: "list",
  // Turbopack compiles route modules lazily in the dev server used below.
  // Two workers still exercise independent browser contexts without letting
  // four cold routes saturate the server and turn otherwise-valid tests into
  // navigation timeouts.
  workers: 2,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
