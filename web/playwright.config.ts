import { defineConfig } from "@playwright/test";

// Smoke test for the in-browser Pyodide runner. Requires a production build
// (`pnpm build`) since webServer runs `next start`. Generous timeouts because
// the first run downloads the Pyodide runtime + numpy/pytest wheels from the CDN.
const port = process.env.PORT || "3000";
const testTimeout = Number(process.env.PW_TEST_TIMEOUT || 150_000);
const expectTimeout = Number(process.env.PW_EXPECT_TIMEOUT || 90_000);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: testTimeout,
  expect: { timeout: expectTimeout },
  fullyParallel: false,
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `pnpm start -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 120_000,
    reuseExistingServer: process.env.PW_REUSE === "1" || !process.env.PORT,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
