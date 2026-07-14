import { defineConfig } from "playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const useProductionServer = process.env.PLAYWRIGHT_SERVER === "production";
// Reusing an arbitrary service on the common port 3000 can silently run this
// repo's tests against another application. Make reuse an explicit opt-in.
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "true";

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
    command: useProductionServer
      ? `npm run start -- --port ${port}`
      : `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer,
    timeout: 120_000,
  },
});
