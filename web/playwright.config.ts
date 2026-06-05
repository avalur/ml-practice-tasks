import { defineConfig } from "@playwright/test";

// Smoke test for the in-browser Pyodide runner. Requires a production build
// (`pnpm build`) since webServer runs `next start`. Generous timeouts because
// the first run downloads the Pyodide runtime + numpy/pytest wheels from the CDN.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 150_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
