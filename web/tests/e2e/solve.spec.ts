import { test, expect } from "@playwright/test";

const ID = "numpy_basics/pairwise_distances";

const CORRECT = `import numpy as np


def pairwise_distances(x, y):
    diff = x[:, None, :] - y[None, :, :]
    return np.sqrt((diff ** 2).sum(axis=-1))
`;

const WRONG = `import numpy as np


def pairwise_distances(x, y):
    return np.zeros((x.shape[0], y.shape[0]))
`;

// Seed the editor via localStorage (SolveWorkspace restores it on mount), so we
// don't have to type multi-line Python into CodeMirror.
async function seed(page: import("@playwright/test").Page, code: string) {
  await page.addInitScript(
    (a: { key: string; value: string }) => localStorage.setItem(a.key, a.value),
    { key: `mlp:code:${ID}`, value: code },
  );
}

test("correct solution passes all tests in-browser", async ({ page }) => {
  await seed(page, CORRECT);
  await page.goto(`/problems/${ID}`);

  const run = page.getByRole("button", { name: "Run tests" });
  await expect(run).toBeEnabled(); // waits for the Pyodide runtime to warm up
  await run.click();

  await expect(page.locator(".results")).toContainText("5/5 tests passed");
});

test("wrong solution reports failures", async ({ page }) => {
  await seed(page, WRONG);
  await page.goto(`/problems/${ID}`);

  const run = page.getByRole("button", { name: "Run tests" });
  await expect(run).toBeEnabled();
  await run.click();

  await expect(page.locator(".results")).toContainText("/5 tests passed");
  await expect(page.locator(".results .result-bad").first()).toBeVisible();
});
