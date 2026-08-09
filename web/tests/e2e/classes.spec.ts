import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { signInAs } from "./support/session";

// Classes smoke tests. The present page is generated static HTML served from
// public/classes (see export_decks.py), so it can be exercised without auth —
// its API calls simply come back 403 and the ink layer keeps working locally.

const CLASS = "ml-intensive-tlf";
const LESSON = "l01-intro-python";
const PRESENT = `/classes/${CLASS}/${LESSON}/present.html`;

test("logged out: classes tab invites sign-in and hides teacher tools", async ({
  page,
  request,
}) => {
  await page.goto("/classes");
  await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();
  await expect(page.getByText(/Sign in to join a class/i)).toBeVisible();

  // A non-member must not see the lesson list, the invite code or practice ids.
  await page.goto(`/classes/${CLASS}`);
  await expect(page.getByText(/not in this class/i)).toBeVisible();
  await expect(page.getByText(/Lecture 5/)).toHaveCount(0);

  // Teacher-only routes are 404, not 403: they should not even confirm existence.
  for (const path of [`/classes/${CLASS}/monitor`, `/classes/${CLASS}/homework`]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

test("view mode: deck renders, no annotation layer attached", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(PRESENT);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());

  const slides = await page.evaluate(() => (window as any).Reveal.getSlides().length);
  expect(slides).toBeGreaterThan(5);

  // Without ?session= the deck must stay untouched — students browsing slides
  // should not get a pen toolbar.
  await expect(page.locator(".ink-bar")).toHaveCount(0);
  await expect(page.locator("canvas.ink-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// A homework that assigns a whole topic ("py_*" → 26 problems) must stay one row
// with a progress count; the 26 tasks live behind a disclosure. Needs a real
// signed-in member, since class pages are members-only.
test("member: a topic assigned as homework renders as one collapsed group", async ({
  page,
  context,
}) => {
  const session = await signInAs(context, {
    email: "e2e-group-student@example.test",
    name: "E2E Student",
    classSlug: CLASS,
  });
  try {
    await session.solveProblem("py_basics/fizz_buzz");
    await session.solveProblem("py_strings/caesar_cipher");

    await page.goto(`/classes/${CLASS}/lessons/${LESSON}`);
    await expect(page.getByRole("heading", { name: /Homework/ })).toBeVisible();

    // One row, not 26.
    const group = page.locator(".ref-group");
    await expect(group).toHaveCount(1);
    await expect(group.locator("summary .title")).toHaveText("Python fundamentals");
    await expect(group.locator("summary .badge")).toHaveText("2/26 done");
    await expect(group.locator("summary code")).toHaveText("py_*");

    // The tasks are present in the DOM but folded away…
    const rows = group.locator(".problem-list .problem-card");
    await expect(rows).toHaveCount(26);
    expect(await rows.first().isVisible()).toBe(false);
    // …and open once expanded, with the solved ones ticked.
    await group.locator("summary").click();
    await expect(rows.first()).toBeVisible();
    await expect(group.getByText("✓ py_basics/fizz_buzz")).toBeVisible();

    // The class overview counts the tasks, not the group.
    await page.goto(`/classes/${CLASS}`);
    await expect(page.getByText("2/26", { exact: false }).first()).toBeVisible();
  } finally {
    await session.dispose();
  }
});

// The authoring loop is `export_decks.py --watch` + ?dev=1: the page must notice
// that it was rewritten and reload itself — and must never do that without the
// flag, because a lecture is projected from the same file.
test("dev mode: ?dev=1 reloads when the page is rebuilt, plain URL does not", async ({
  page,
}) => {
  const target = path.join(
    __dirname,
    "..",
    "..",
    "public",
    "classes",
    CLASS,
    LESSON,
    "present.html",
  );
  const original = await fs.readFile(target);

  // A reload is observable as the loss of a marker set on window.
  const mark = async () => page.evaluate(() => ((window as any).__devMark = 1));
  const marked = () => page.evaluate(() => (window as any).__devMark === 1);
  const rebuild = async (note: string) =>
    fs.writeFile(target, Buffer.concat([original, Buffer.from(`\n<!-- ${note} -->\n`)]));

  try {
    // No flag: rebuilding must leave the page alone.
    await page.goto(PRESENT);
    await page.waitForFunction(() => (window as any).Reveal?.isReady?.());
    await expect(page.locator(".dev-reload-badge")).toHaveCount(0);
    await mark();
    await rebuild("probe without the flag");
    await page.waitForTimeout(3000);
    expect(await marked(), "a plain present.html reloaded itself").toBe(true);

    // With the flag: the badge appears and the next rebuild reloads the page.
    await fs.writeFile(target, original);
    await page.goto(`${PRESENT}?dev=1`);
    await expect(page.locator(".dev-reload-badge")).toHaveText("live");
    await mark();
    await rebuild("probe with the flag");
    await expect
      .poll(marked, { timeout: 10_000, intervals: [200] })
      .toBe(false);
    await page.waitForFunction(() => (window as any).Reveal?.isReady?.());
  } finally {
    // Leave the generated tree exactly as export_decks.py wrote it, or
    // `export_decks.py --check` starts failing for everyone.
    await fs.writeFile(target, original);
  }

  expect(await fs.readFile(target)).toEqual(original);
});

test("present mode: pen draws, undo clears", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${PRESENT}?session=smoke-test`);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());
  await expect(page.locator(".ink-bar")).toBeVisible();

  const canvas = page.locator("canvas.ink-canvas");
  await expect(canvas).toHaveCount(1);

  // Count opaque pixels on the ink canvas — the honest check that a stroke landed.
  const inkPixels = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas.ink-canvas") as HTMLCanvasElement;
      const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    });

  expect(await inkPixels()).toBe(0);

  // Red is reserved for the laser, so it must not be offered as a pen colour,
  // and the default has to be one of the remaining ones (blue).
  const swatches = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ink-swatch")).map((b) => ({
      color: (b as HTMLElement).dataset.color,
      on: b.classList.contains("on"),
    })),
  );
  expect(swatches.length).toBeGreaterThan(2);
  expect(swatches.filter((s) => s.on).map((s) => s.color)).toEqual(["#1b6ef3"]);
  for (const s of swatches) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(s.color!.slice(i, i + 2), 16));
    expect(r > 180 && g < 110 && b < 110, `pen colour ${s.color} reads as red`).toBe(
      false,
    );
  }

  await page.keyboard.press("d"); // enable the pen
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      box.x + box.width * (0.3 + i * 0.02),
      box.y + box.height * (0.4 + i * 0.015),
    );
  }
  await page.mouse.up();

  const drawn = await inkPixels();
  expect(drawn).toBeGreaterThan(100);

  // Undo must remove that stroke entirely, not just part of it.
  await page.keyboard.press("u");
  expect(await inkPixels()).toBe(0);

  expect(errors).toEqual([]);
});

// Boards must be first-class pages of the deck, not an overlay: they have to
// appear in Reveal.getSlides(), navigate normally, and survive a reload.
test("present mode: boards are real slides, insert and delete", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());

  await page.goto(`${PRESENT}?session=smoke-test`);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());

  const count = () => page.evaluate(() => (window as any).Reveal.getSlides().length);
  const before = await count();

  // Every original slide gets a stable id up front — that is what keeps ink
  // attached to the right page once inserting a board shifts the h.v indices.
  const ids = await page.evaluate(() =>
    (window as any).Reveal.getSlides().map((s: HTMLElement) => s.dataset.mlpId),
  );
  expect(ids.every((id: string) => /^s\d+$/.test(id))).toBe(true);
  expect(new Set(ids).size).toBe(before);

  // Note: Reveal.slide() takes horizontal/vertical indices, which are not the
  // leaf order that getSlides() returns — so read back where we actually landed.
  await page.evaluate(() => (window as any).Reveal.slide(2, 0));
  const anchorId = await page.evaluate(
    () => (window as any).Reveal.getCurrentSlide().dataset.mlpId,
  );
  await page.keyboard.press("b");

  expect(await count()).toBe(before + 1);
  const cur = await page.evaluate(() => {
    const s = (window as any).Reveal.getCurrentSlide();
    return { id: s.dataset.mlpId, board: s.classList.contains("mlp-board") };
  });
  expect(cur.board).toBe(true);
  expect(cur.id).toBe("b1");

  // The board sits immediately after the slide it was inserted from.
  const order = await page.evaluate(() =>
    (window as any).Reveal.getSlides().map((s: HTMLElement) => s.dataset.mlpId),
  );
  expect(order[order.indexOf("b1") - 1]).toBe(anchorId);

  // Delete only acts on boards: on a normal slide the button is disabled.
  await page.keyboard.press("B");
  expect(await count()).toBe(before);
  await expect(page.locator(".ink-del-board")).toBeDisabled();
  await page.keyboard.press("B");
  expect(await count()).toBe(before);

  expect(errors).toEqual([]);
});

// The laser is a pointer, not a pen: it must leave nothing behind on the ink
// canvas, and nothing that could reach the saved PDF. Its Tail behaviour is all
// timing, so the assertions lean on the mlpLaser() state hook to decide *when*
// to look, and on the canvas pixels to decide *what* is there.
test("present mode: laser trail survives movement, revives, then fades", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${PRESENT}?session=smoke-test`);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());

  // One pass over the laser canvas: how much is drawn, how strong it is on
  // average, how wide a span it covers, and whether it is red. Mean alpha rather
  // than max, because the head dot and the glow overlap the stroke and keep the
  // brightest pixel at 255 well into the fade.
  const trail = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas.ink-laser") as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0, sumA = 0, minX = c.width, maxX = -1, red = 0, other = 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (!a) continue;
        n++;
        sumA += a;
        const x = (i / 4) % c.width;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (a > 200) (d[i] > 180 && d[i + 1] < 110 && d[i + 2] < 110 ? red++ : other++);
      }
      return {
        n,
        meanA: n ? sumA / n : 0,
        span: maxX < 0 ? 0 : (maxX - minX) / c.width,
        red,
        other,
      };
    });
  const inkPixels = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas.ink-canvas") as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
  const laser = () => page.evaluate(() => (window as any).mlpLaser());

  await page.keyboard.press("l");
  await expect(page.locator(".ink-laser")).toHaveCount(1);

  // Sweep for well over 2 s. Nothing may expire while the pointer keeps moving,
  // so the whole span has to still be on screen at the end — an age-based decay
  // would have dropped everything older than a second.
  const box = (await page.locator("canvas.ink-canvas").boundingBox())!;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.2, y);
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + i * 0.027), y);
    await page.waitForTimeout(90);
  }
  const swept = await trail();
  expect(swept.n).toBeGreaterThan(50);
  expect(swept.span).toBeGreaterThan(0.5);
  expect((await laser()).fade).toBe(0);
  // Red, whatever the pen is set to — and the pen is never red.
  expect(swept.red).toBeGreaterThan(swept.other);
  // Crucially: the persistent layer stays untouched.
  expect(await inkPixels()).toBe(0);

  // Standing still starts the fade...
  await expect
    .poll(async () => (await laser()).fade, { timeout: 5000, intervals: [50] })
    .toBeGreaterThan(0.45);
  const faded = await trail();
  expect(faded.meanA).toBeLessThan(swept.meanA * 0.8);

  // ...and moving again pulls the same trail back to full strength rather than
  // starting a new one.
  await page.mouse.move(box.x + box.width * 0.85, y + 2);
  await page.mouse.move(box.x + box.width * 0.86, y + 2);
  await expect
    .poll(async () => (await laser()).fade, { timeout: 3000, intervals: [50] })
    .toBe(0);
  const revived = await trail();
  expect(revived.meanA).toBeGreaterThan(swept.meanA * 0.9);
  expect(revived.span).toBeGreaterThan(0.5);

  // Left alone it goes completely: HOLD + FADE is ~1.25 s.
  await expect
    .poll(() => trail().then((t) => t.n), { timeout: 8000, intervals: [250] })
    .toBe(0);
  expect(await inkPixels()).toBe(0);

  expect(errors).toEqual([]);
});

// The whole point of the feature is the PDF, and a failure here would only show
// up at the end of a real lecture — so exercise the real pipeline: html2canvas
// over every slide, ink composited on top, jsPDF assembly, then the download.
// Nothing is uploaded: the teacher shares the file themselves.
test("present mode: Finish lesson builds a PDF of every page", async ({ page }) => {
  test.slow(); // html2canvas over a 20+ slide deck is not fast

  page.on("dialog", (d) => d.accept()); // the confirm()

  await page.goto(`${PRESENT}?session=smoke-test`);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());
  const slides = await page.evaluate(() => (window as any).Reveal.getSlides().length);

  // Draw something so at least one page carries ink into the PDF.
  await page.keyboard.press("d");
  const box = (await page.locator("canvas.ink-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
  await page.mouse.up();

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Finish lesson" }).click();

  // Deliberately no assertion on the progress overlay's text: it is a transient
  // element whose content changes many times a second, and waiting on it cost a
  // minute of wall clock for no extra coverage. The /Count check below proves the
  // export really walked the whole deck, which is what it was standing in for.
  const download = await downloadPromise;
  // Named for sharing: class, lesson and the date of the lecture.
  expect(download.suggestedFilename()).toMatch(
    new RegExp(`^${CLASS}-${LESSON}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`),
  );

  // No upload machinery may linger: there is no Blob bridge iframe any more.
  await expect(page.locator('iframe[src*="blob-bridge"]')).toHaveCount(0);

  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  // One JPEG page per slide: a deck this size cannot fit in a few KB.
  expect(bytes.length).toBeGreaterThan(50_000);

  // Page count is written in the PDF body as /Count N.
  const count = Number(/\/Count (\d+)/.exec(bytes.toString("latin1"))?.[1]);
  expect(count).toBe(slides);
});

// Regression guard for a bug that produced a plausible-looking PDF with the
// right page count where nine of eighteen pages were blank: html2canvas ignores
// reveal's stylesheet z-index and painted `.backgrounds` over `.slides`, so every
// slide with an opaque data-background-color lost all of its content. Counting
// pages is not enough — each page has to be checked for actual pixels.
test("present mode: no exported page loses its slide content", async ({ page }) => {
  test.slow();
  page.on("dialog", (d) => d.accept());

  await page.goto(`${PRESENT}?session=smoke-test`);
  await page.waitForFunction(() => (window as any).Reveal?.isReady?.());
  await page.waitForTimeout(1500);

  // Which slides genuinely have something to render. (intro_to_python ends on a
  // decorative empty <canvas>, so "every page is non-blank" would be wrong.)
  const hasContent: boolean[] = await page.evaluate(() =>
    (window as any).Reveal.getSlides().map((s: HTMLElement) => {
      const text = (s.textContent || "").trim();
      return (
        text.length > 20 ||
        !!s.querySelector("img, pre, code, table, svg, script[type^='py']")
      );
    }),
  );

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Finish lesson" }).click();
  const download = await downloadPromise;
  const { readFileSync } = await import("node:fs");
  const pdf = readFileSync((await download.path())!);

  // Each page is one embedded JPEG, in order.
  const pages: Buffer[] = [];
  for (let i = 0; ; ) {
    const start = pdf.indexOf("\xff\xd8\xff", i, "latin1");
    if (start < 0) break;
    const end = pdf.indexOf("\xff\xd9", start, "latin1");
    if (end < 0) break;
    pages.push(pdf.subarray(start, end + 2));
    i = end + 2;
  }
  expect(pages.length).toBe(hasContent.length);

  // A blank page compresses to almost nothing; a page with a slide on it cannot.
  // The threshold is deliberately loose — the bug turned 100+ KB pages into 16 KB.
  const blank = pages
    .map((p, i) => ({ page: i + 1, kb: Math.round(p.length / 1024), expected: hasContent[i] }))
    .filter((p) => p.expected && p.kb < 25);
  expect(blank, `pages that came out blank: ${JSON.stringify(blank)}`).toEqual([]);
});
