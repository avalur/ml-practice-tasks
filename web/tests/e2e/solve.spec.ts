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

test("fullscreen: toggle, layout, and scroll locking", async ({ page }) => {
  await seed(page, CORRECT);
  await page.goto(`/problems/${ID}`);
  // Wait for Pyodide to warm up and the run button to be enabled
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  const enterFsBtn = page.getByRole("button", { name: "Enter fullscreen" });
  const workspace = page.locator(".workspace");

  // Enter fullscreen
  await enterFsBtn.click();
  await expect(workspace).toHaveClass(/fullscreen/);
  await expect(workspace).toHaveCSS("position", "fixed");
  
  // Verify bounding box matches viewport
  const viewport = page.viewportSize();
  const box = await workspace.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeCloseTo(viewport!.width, -1);
  expect(box?.height).toBeCloseTo(viewport!.height, -1);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  // Verify desktop pane visibility and aligned tops
  await expect(page.locator(".workspace .cm-editor")).toBeVisible();
  await expect(page.locator(".output-pane")).toBeVisible();
  await expect(page.locator(".output-pane .placeholder-output")).toBeVisible();

  const editorBox = await page.locator(".editor-pane").boundingBox();
  const outputBox = await page.locator(".output-pane").boundingBox();
  expect(editorBox).not.toBeNull();
  expect(outputBox).not.toBeNull();
  expect(Math.abs(editorBox!.y - outputBox!.y)).toBeLessThan(20);
  // Ensure output pane is to the right of the editor pane (side-by-side)
  expect(outputBox?.x).toBeGreaterThan(editorBox!.x + editorBox!.width - 20);

  // Exit via button
  await page.getByRole("button", { name: "Exit fullscreen (Esc)" }).click();
  await expect(workspace).not.toHaveClass(/fullscreen/);
  await expect(workspace).not.toHaveCSS("position", "fixed");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  // Verify CodeMirror editor height returns to standard (~360px)
  const inlineEditorBox = await page.locator(".workspace .cm-editor").boundingBox();
  expect(inlineEditorBox).not.toBeNull();
  expect(inlineEditorBox!.height).toBeCloseTo(360, -1);
  
  // Re-enter and exit via Escape
  await enterFsBtn.click();
  await expect(workspace).toHaveClass(/fullscreen/);
  await page.keyboard.press("Escape");
  await expect(workspace).not.toHaveClass(/fullscreen/);
});

test("fullscreen: run passing tests via keyboard shortcut and persist results", async ({ page }) => {
  await seed(page, CORRECT);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  // Run tests via Control+Enter inside fullscreen
  await page.keyboard.press("Control+Enter");

  // Assert results in output pane
  const outputPane = page.locator(".output-pane");
  await expect(outputPane.locator(".results")).toContainText("5/5 tests passed");
  await expect(outputPane.locator(".test-row").first()).toBeVisible();

  // Exit fullscreen and verify results persist in normal view
  await page.getByRole("button", { name: "Exit fullscreen (Esc)" }).click();
  await expect(page.locator(".workspace")).not.toHaveClass(/fullscreen/);
  await expect(page.locator(".results")).toContainText("5/5 tests passed");
  await expect(page.locator(".test-row").first()).toBeVisible();
});

test("fullscreen: reference tabs and What's next panel for solved task", async ({ page }) => {
  const FIZZ_ID = "py_basics/fizz_buzz";
  await page.addInitScript(
    (a: { codeKey: string; solvedKey: string }) => {
      localStorage.setItem(a.codeKey, "def fizz_buzz(n):\n    pass\n");
      localStorage.setItem(a.solvedKey, "1");
    },
    {
      codeKey: `mlp:code:${FIZZ_ID}`,
      solvedKey: `mlp:solved:${FIZZ_ID}`,
    },
  );
  await page.goto(`/problems/${FIZZ_ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Reference solution tab and What's next panel are present
  await expect(page.getByRole("button", { name: "Reference solution" })).toBeVisible();
  await expect(page.locator(".next-tasks-panel")).toBeVisible();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  // Tabs and next tasks panel are visible inside fullscreen
  await expect(page.locator(".editor-pane .solution-tabs")).toBeVisible();
  await expect(page.locator(".output-pane .next-tasks-panel")).toBeVisible();

  // Switch to reference tab inside fullscreen
  await page.getByRole("button", { name: "Reference solution" }).click();
  await expect(page.locator(".cm-content")).toContainText("FizzBuzz");

  // Switch back to your solution
  await page.getByRole("button", { name: "Your solution" }).click();
  await expect(page.locator(".cm-content")).toContainText("def fizz_buzz(n):");

  // Exit fullscreen
  await page.getByRole("button", { name: "Exit fullscreen (Esc)" }).click();
  await expect(page.locator(".workspace")).not.toHaveClass(/fullscreen/);
  await expect(page.locator(".solution-tabs")).toBeVisible();
  await expect(page.locator(".next-tasks-panel")).toBeVisible();
});

test("fullscreen: scratchpad stdout and stderr", async ({ page }) => {
  const code = `print("fs-stdout-marker")
raise ValueError("fs-boom")`;
  await seed(page, code);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  // Run scratchpad code
  await page.getByRole("button", { name: "Run", exact: true }).click();
  
  // Assert stdout and error text
  const outputPane = page.locator(".output-pane");
  // Use :not(.result-bad) to be strict and target only the stdout trace
  await expect(outputPane.locator("pre.code.trace:not(.result-bad)")).toContainText("fs-stdout-marker");
  await expect(outputPane.locator("pre.result-bad")).toContainText("fs-boom");
  await expect(outputPane.locator(".placeholder-output")).not.toBeVisible();
});

test("fullscreen: edit persistence", async ({ page }) => {
  await seed(page, CORRECT);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  // Edit in fullscreen
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n# fs-edit-marker");
  await expect(page.locator(".cm-content")).toContainText("# fs-edit-marker");

  // Exit via button
  await page.getByRole("button", { name: "Exit fullscreen (Esc)" }).click();
  await expect(page.locator(".workspace")).not.toHaveClass(/fullscreen/);
  await expect(page.locator(".cm-content")).toContainText("# fs-edit-marker");

  // Enter again and exit via Escape
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace")).not.toHaveClass(/fullscreen/);
  await expect(page.locator(".cm-content")).toContainText("# fs-edit-marker");
});

test("fullscreen: long code sizing", async ({ page }) => {
  const LONG_CODE = `# Long code comment\n`.repeat(150) + CORRECT;
  await seed(page, LONG_CODE);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  // Poll for stable sizing
  await expect.poll(async () => {
    const scroller = page.locator(".cm-scroller");
    const metrics = await scroller.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    return metrics.scrollHeight > metrics.clientHeight && metrics.clientHeight < metrics.viewportHeight;
  }, { message: "Scroller should be properly bounded", timeout: 5000 }).toBe(true);
});

test("fullscreen: mobile scrollability", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 400 });
  await seed(page, WRONG);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);

  await page.getByRole("button", { name: "Run tests" }).click();
  
  // Prove failing result is shown
  await expect(page.locator(".output-pane .banner.result-bad")).toBeVisible();
  await expect(page.locator(".output-pane .test-row .result-bad").first()).toBeVisible();

  // Verify responsive stacked layout: panes must not overlap vertically
  const editorBox = await page.locator(".editor-pane").boundingBox();
  const outputBox = await page.locator(".output-pane").boundingBox();
  expect(editorBox).not.toBeNull();
  expect(outputBox).not.toBeNull();
  expect(outputBox!.y).toBeGreaterThanOrEqual(editorBox!.y + editorBox!.height);

  // Verify scrollability on small screen
  await expect(page.locator(".workspace")).toHaveCSS("overflow-y", "auto");
  const isScrollable = await page.locator(".workspace").evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(isScrollable).toBe(true);

  // Verify output reachability by scrolling the last test row into view
  const lastRow = page.locator(".output-pane .test-row").last();
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).toBeInViewport();
});

test("fullscreen: font zoom with wheel, keyboard shortcuts, and reset button", async ({ page }) => {
  await seed(page, CORRECT);
  await page.goto(`/problems/${ID}`);
  await expect(page.getByRole("button", { name: "Run tests" })).toBeEnabled();

  // Enter fullscreen
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  const workspace = page.locator(".workspace");
  await expect(workspace).toHaveClass(/fullscreen/);

  const getEditorFontSize = async () => {
    return await page.locator(".workspace .cm-editor").evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
  };

  const initialSize = await getEditorFontSize();
  expect(initialSize).toBeCloseTo(14, 0);

  // Zoom in using Control + Wheel (deltaY < 0)
  await workspace.dispatchEvent("wheel", { deltaY: -100, ctrlKey: true });
  const zoomedInSize = await getEditorFontSize();
  expect(zoomedInSize).toBeGreaterThan(initialSize);

  // Zoom indicator / reset button should be visible in toolbar
  const resetBtn = page.getByRole("button", { name: "Reset font zoom" });
  await expect(resetBtn).toBeVisible();

  // Click reset button
  await resetBtn.click();
  const resetSize = await getEditorFontSize();
  expect(resetSize).toBeCloseTo(14, 0);
  await expect(resetBtn).not.toBeVisible();

  // Zoom in using keyboard shortcut Control + =
  await page.keyboard.press("Control+=");
  const kbZoomedIn = await getEditorFontSize();
  expect(kbZoomedIn).toBeGreaterThan(14);

  // Zoom out using keyboard shortcut Control + -
  await page.keyboard.press("Control+-");
  await page.keyboard.press("Control+-");
  const kbZoomedOut = await getEditorFontSize();
  expect(kbZoomedOut).toBeLessThan(kbZoomedIn);

  // Reset using keyboard shortcut Control + 0
  await page.keyboard.press("Control+0");
  const kbReset = await getEditorFontSize();
  expect(kbReset).toBeCloseTo(14, 0);
});
