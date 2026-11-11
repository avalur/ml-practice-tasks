import { test, expect } from "@playwright/test";

const ID = "numpy_basics/pairwise_distances";
const BOUNDED_QUEUE_ID = "py_threads/bounded_queue";

const CORRECT = `import numpy as np


def pairwise_distances(x, y):
    diff = x[:, None, :] - y[None, :, :]
    return np.sqrt((diff ** 2).sum(axis=-1))
`;

const WRONG = `import numpy as np


def pairwise_distances(x, y):
    return np.zeros((x.shape[0], y.shape[0]))
`;

const BOUNDED_QUEUE_CORRECT = `from collections import deque
import threading
import time
from typing import Any


class QueueEmpty(Exception):
    pass


class QueueFull(Exception):
    pass


class BoundedQueue:
    def __init__(self, capacity: int) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be greater than 0")
        self._capacity = capacity
        self._queue: deque[Any] = deque()
        self._lock = threading.Lock()
        self._not_empty = threading.Condition(self._lock)
        self._not_full = threading.Condition(self._lock)

    def put(self, item: Any, timeout: float | None = None) -> None:
        with self._lock:
            if timeout is not None and timeout <= 0:
                if len(self._queue) >= self._capacity:
                    raise QueueFull("Queue is full")
            elif timeout is not None:
                deadline = time.monotonic() + timeout
                while len(self._queue) >= self._capacity:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise QueueFull("Queue is full")
                    self._not_full.wait(remaining)
            else:
                while len(self._queue) >= self._capacity:
                    self._not_full.wait()
            self._queue.append(item)
            self._not_empty.notify()

    def get(self, timeout: float | None = None) -> Any:
        with self._lock:
            if timeout is not None and timeout <= 0:
                if not self._queue:
                    raise QueueEmpty("Queue is empty")
            elif timeout is not None:
                deadline = time.monotonic() + timeout
                while not self._queue:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise QueueEmpty("Queue is empty")
                    self._not_empty.wait(remaining)
            else:
                while not self._queue:
                    self._not_empty.wait()
            item = self._queue.popleft()
            self._not_full.notify()
            return item

    def qsize(self) -> int:
        with self._lock:
            return len(self._queue)

    def empty(self) -> bool:
        with self._lock:
            return len(self._queue) == 0

    def full(self) -> bool:
        with self._lock:
            return len(self._queue) >= self._capacity
`;

const BOUNDED_QUEUE_RACY = `import time


class QueueFull(Exception):
    pass


class QueueEmpty(Exception):
    pass


class BoundedQueue:
    def __init__(self, capacity):
        if capacity <= 0:
            raise ValueError("capacity")
        self._buf = [None] * capacity
        self._cap = capacity
        self._head = 0
        self._tail = 0
        self._size = 0

    def qsize(self):
        return self._size

    def empty(self):
        return self._size == 0

    def full(self):
        return self._size >= self._cap

    def put(self, item, timeout=None):
        deadline = None if timeout is None else time.monotonic() + timeout
        while self._size >= self._cap:
            if deadline is not None and time.monotonic() >= deadline:
                raise QueueFull
            time.sleep(0.001)
        self._buf[self._tail] = item
        self._tail = (self._tail + 1) % self._cap
        self._size += 1

    def get(self, timeout=None):
        deadline = None if timeout is None else time.monotonic() + timeout
        while self._size == 0:
            if deadline is not None and time.monotonic() >= deadline:
                raise QueueEmpty
            time.sleep(0.001)
        item = self._buf[self._head]
        self._head = (self._head + 1) % self._cap
        self._size -= 1
        return item
`;

// Seed the editor via localStorage (SolveWorkspace restores it on mount), so we
// don't have to type multi-line Python into CodeMirror.
async function seed(
  page: import("@playwright/test").Page,
  code: string,
  id = ID,
) {
  await page.addInitScript(
    (a: { key: string; value: string }) => localStorage.setItem(a.key, a.value),
    { key: `mlp:code:${id}`, value: code },
  );
}

test("threaded bounded queue passes in-browser with the Pyodide shim", async ({ page }) => {
  await seed(page, BOUNDED_QUEUE_CORRECT, BOUNDED_QUEUE_ID);
  await page.goto(`/problems/${BOUNDED_QUEUE_ID}`);

  const run = page.getByRole("button", { name: "Run tests" });
  await expect(run).toBeEnabled();
  await run.click();

  await expect(page.locator(".results")).toContainText("7/7 tests passed");
});

test("threaded bounded queue detects a lock-free race in-browser", async ({ page }) => {
  await seed(page, BOUNDED_QUEUE_RACY, BOUNDED_QUEUE_ID);
  await page.goto(`/problems/${BOUNDED_QUEUE_ID}`);

  const run = page.getByRole("button", { name: "Run tests" });
  await expect(run).toBeEnabled();
  await run.click();

  await expect(page.locator(".results")).toContainText("6/7 tests passed");
  await expect(page.locator(".results")).toContainText("test_concurrent_producers_consumers");
});

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

// A correct FizzBuzz written differently from the reference: same signature and
// docstring (so they collapse as unchanged), a different body.
const FIZZ_OTHER_WAY = `def get_fizz_buzz(n: int) -> list[int | str]:
    """
    Return a list of length \`\`n\`\` whose element at position \`\`i\`\` (0-based)
    describes the number \`\`i + 1\`\`:

    * \`\`"FizzBuzz"\`\` if the number is divisible by 15,
    * \`\`"Fizz"\`\`     if divisible by 3 (but not 15),
    * \`\`"Buzz"\`\`     if divisible by 5 (but not 15),
    * otherwise the number itself (an \`\`int\`\`).

    For example \`\`get_fizz_buzz(5) == [1, 2, "Fizz", 4, "Buzz"]\`\`.

    :param n: length of the sequence (\`\`n >= 0\`\`)
    :return: the FizzBuzz list
    """
    out = []
    for i in range(1, n + 1):
        s = ""
        if i % 3 == 0:
            s += "Fizz"
        if i % 5 == 0:
            s += "Buzz"
        out.append(s or i)
    return out
`;

test("compare view: solved problem diffs your code against the reference", async ({ page }) => {
  const FIZZ_ID = "py_basics/fizz_buzz";
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(
    (a: { codeKey: string; codeVal: string; solvedKey: string }) => {
      // Only on the first load: the test reads the autosaved draft back later.
      if (localStorage.getItem(a.solvedKey)) return;
      localStorage.setItem(a.codeKey, a.codeVal);
      localStorage.setItem(a.solvedKey, "1");
    },
    { codeKey: `mlp:code:${FIZZ_ID}`, codeVal: FIZZ_OTHER_WAY, solvedKey: `mlp:solved:${FIZZ_ID}` },
  );
  await page.goto(`/problems/${FIZZ_ID}`);
  await page.getByRole("button", { name: "Compare" }).click();

  // Wide pane: two columns, yours on the left, the reference on the right.
  const compare = page.locator(".compare");
  await expect(compare).toHaveAttribute("data-mode", "split");
  const mine = compare.locator(".cm-mergeView .mlp-diff-mine");
  const ref = compare.locator(".cm-mergeView .mlp-diff-ref");
  await expect(mine).toContainText("out.append(s or i)");
  await expect(ref).toContainText('result.append("FizzBuzz")');
  await expect(compare.locator(".compare-legend")).toContainText("2 differences");

  // Changed lines and the changed words inside them are highlighted, each side
  // in its own colour; the shared docstring is folded away.
  await expect(mine.locator(".cm-changedLine").first()).toBeVisible();
  await expect(ref.locator(".cm-changedLine").first()).toBeVisible();
  await expect(mine.locator(".cm-changedText", { hasText: "out" }).first()).toBeVisible();
  await expect(ref.locator(".cm-changedText", { hasText: "result" }).first()).toBeVisible();
  const bg = (loc: import("@playwright/test").Locator) =>
    loc.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const mineBg = await bg(mine.locator(".cm-changedLine"));
  const refBg = await bg(ref.locator(".cm-changedLine"));
  expect(mineBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(refBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(mineBg).not.toBe(refBg);
  await expect(mine.locator(".cm-collapsedLines")).toContainText("unchanged lines");
  await expect(mine).not.toContainText("divisible by 15");

  // The reference is read-only; your side edits your code (and autosaves it).
  await expect(ref.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
  await mine.locator(".cm-line", { hasText: "return out" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type("  # mine");
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), `mlp:code:${FIZZ_ID}`))
    .toContain("return out  # mine");

  // Switching theme (whichever one the page started in) recolours the editors
  // and the highlights, and keeps the diff.
  const from = await page.locator("html").getAttribute("data-theme");
  const to = from === "light" ? "dark" : "light";
  const editorBg = await mine.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator("header").getByRole("button", { name: /theme/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", to);
  await expect
    .poll(() => mine.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(editorBg);
  await expect.poll(() => bg(mine.locator(".cm-changedLine"))).not.toBe(mineBg);
  await expect.poll(() => bg(mine.locator(".cm-changedLine"))).not.toBe("rgba(0, 0, 0, 0)");
  await expect(mine).toContainText("return out  # mine");

  // Fullscreen: still the diff, filling the editor pane.
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);
  await expect(compare).toHaveAttribute("data-mode", "split");
  const paneH = (await page.locator(".editor-pane").boundingBox())!.height;
  const cmH = (await compare.locator(".compare-cm").boundingBox())!.height;
  expect(cmH).toBeGreaterThan(paneH * 0.8);

  // Phone width: one column — your code, with the reference's lines in between.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(compare).toHaveAttribute("data-mode", "unified");
  await expect(compare.locator(".cm-mergeView")).toHaveCount(0);
  await expect(compare.locator(".mlp-diff-mine .cm-changedLine").first()).toBeVisible();
  await expect(compare.locator(".cm-deletedChunk", { hasText: 'result.append("FizzBuzz")' })).toBeVisible();
  await expect(compare.locator(".compare-legend")).toContainText("2 differences");

  // Back on your own code, the edit made in the diff is there.
  await page.getByRole("button", { name: "Your solution" }).click();
  await expect(page.locator(".editor-cm .cm-content")).toContainText("return out  # mine");
});

test("phone: a long line of code never widens the problem page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(
    page,
    `${CORRECT}\n# ${"a deliberately long comment that runs well past a phone screen ".repeat(3)}\n`,
  );
  await page.goto(`/problems/${ID}`);
  await expect(page.locator(".editor-cm .cm-content")).toContainText("deliberately long");

  // The page fits the screen; the editor scrolls sideways inside itself instead.
  const widths = () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      screen: window.innerWidth,
      scroller: document.querySelector(".editor-cm .cm-scroller")!.scrollWidth,
    }));
  let w = await widths();
  expect(w.page).toBeLessThanOrEqual(w.screen);
  expect(w.scroller).toBeGreaterThan(w.screen);

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/fullscreen/);
  const ws = await page.locator(".workspace").evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(ws[0]).toBeLessThanOrEqual(ws[1]);
  w = await widths();
  expect(w.page).toBeLessThanOrEqual(w.screen);
});
