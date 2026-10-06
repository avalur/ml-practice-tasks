import { defineConfig } from "@playwright/test";

// Smoke test for the in-browser Pyodide runner. Requires a production build
// (`pnpm build`) since webServer runs `next start`. Generous timeouts because
// the first run downloads the Pyodide runtime + numpy/pytest wheels from the CDN.
const port = process.env.PORT || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 150_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `pnpm start -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.PORT && true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
