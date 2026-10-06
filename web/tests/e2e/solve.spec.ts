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

  // Reference solution tab appears after passing all tests
  const refTab = page.getByRole("button", { name: "Reference solution" });
  const yourTab = page.getByRole("button", { name: "Your solution" });
  await expect(refTab).toBeVisible();
  await expect(yourTab).toBeVisible();

  // Switching to reference solution loads the reference implementation
  await refTab.click();
  await expect(page.locator(".cm-content")).toContainText("diff = x[:, None, :] - y[None, :, :]");

  // Reloading the page retains access to the reference solution tab
  await page.reload();
  await expect(page.getByRole("button", { name: "Reference solution" })).toBeVisible();

  // Resetting the problem hides the reference solution tab
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("button", { name: "Reference solution" })).not.toBeVisible();
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

test("already solved problem displays reference solution tab on load", async ({ page }) => {
  await page.addInitScript(
    (a: { codeKey: string; codeVal: string; solvedKey: string }) => {
      localStorage.setItem(a.codeKey, a.codeVal);
      localStorage.setItem(a.solvedKey, "1");
    },
    {
      codeKey: `mlp:code:${ID}`,
      codeVal: CORRECT,
      solvedKey: `mlp:solved:${ID}`,
    },
  );
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Reference solution" })).toBeVisible();
  await page.getByRole("button", { name: "Reference solution" }).click();
  await expect(page.locator(".cm-content")).toContainText("diff = x[:, None, :] - y[None, :, :]");
});
