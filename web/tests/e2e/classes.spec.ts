import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { draftClass, signInAs } from "./support/session";

// Classes smoke tests. The present page is generated static HTML served from
// public/classes (see export_decks.py), so it can be exercised without auth —
// its API calls simply come back 403 and the ink layer keeps working locally.

const CLASS = "ml-intensive-tlf";
const LESSON = "l01-intro-python";
const PRESENT = `/classes/${CLASS}/${LESSON}/present.html`;

// The course is open: a visitor with no account reads the lessons, the slides and
// the task lists. The code is not a gate any more — it says whose homework the
// teacher tracks — and the annotated notes are the one thing it still buys.
test("logged out: the class is readable, its notes and teacher tools are not", async ({
  page,
  request,
}) => {
  await page.goto("/classes");
  await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /ML Intensive for TLF/ })).toBeVisible();

  await page.goto(`/classes/${CLASS}`);
  await expect(page.getByText(/Lecture 5/)).toBeVisible();
  await expect(page.getByText(/enter your teacher’s group code/)).toBeVisible();
  // No code box for a visitor who cannot be enrolled anyway…
  await expect(page.locator("#class-code")).toHaveCount(0);
  // …and nothing that belongs to the teacher.
  await expect(page.getByText(/Live monitor/)).toHaveCount(0);

  await page.goto(`/classes/${CLASS}/lessons/${LESSON}`);
  await expect(page.getByRole("heading", { name: /Python Refresher/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open slides" })).toBeVisible();
  await expect(page.getByTestId("lecture-pdf")).toHaveCount(0);

  // Teacher-only routes are 404, not 403: they should not even confirm existence.
  // The lecture-notes download is members-only for the same reason — it hands out
  // a signed URL into a private Blob store.
  for (const path of [
    `/classes/${CLASS}/monitor`,
    `/classes/${CLASS}/homework`,
    `/api/classes/${CLASS}/lessons/${LESSON}/notes`,
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }

  // Joining and minting codes both need an account, and a code mints only for a
  // teacher of that class.
  const join = await request.post("/api/classes/join", { data: { code: "WHATEVER" } });
  expect(join.status()).toBe(401);
  const mint = await request.post(`/api/classes/${CLASS}/invites`, {
    data: { code: "TLF-STEAL", label: "mine now" },
  });
  expect(mint.ok()).toBe(false);
});

// A code is a group: the student types it, and that is what puts them in the
// teacher's homework table under that group's name.
test("student: entering a group code joins the class and records the group", async ({
  page,
  context,
}) => {
  const session = await signInAs(context, {
    email: "e2e-join-student@example.test",
    name: "E2E Joiner",
  });
  try {
    const code = await session.createInvite(CLASS, "Autumn stream A");
    expect(await session.myGroup(CLASS)).toBeNull();

    await page.goto(`/classes/${CLASS}`);
    // Signed in but not in a group yet — the box is offered, not demanded.
    await expect(page.getByText(/Got a group code/)).toBeVisible();

    // Typed the way a student would: lower case, dashes forgotten.
    await page.locator("#class-code").fill(code.toLowerCase().replace(/-/g, " "));
    await page.getByRole("button", { name: "Join" }).click();

    await expect(page.getByText(/You are in this class as/)).toBeVisible();
    await expect(page.getByText("Autumn stream A")).toBeVisible();
    expect(await session.myGroup(CLASS)).toBe("Autumn stream A");
  } finally {
    await session.dispose();
  }
});

/* A class can be written in the open repo without being on the site: while
 * Class.publishedAt is null it belongs to its teachers and to nobody else. The
 * point of the button is that publishing needs no deploy, so both directions are
 * exercised through the UI and read back from the database.
 *
 * Runs on a scratch class (see draftClass) rather than the real course, because
 * this suite talks to the live database. */
test("draft class: only its teacher sees it, and Publish puts it live", async ({
  page,
  context,
  browser,
}) => {
  const fixture = await draftClass({
    slug: `e2e-draft-${process.pid}`,
    title: `E2E Scratch Class ${process.pid}`,
  });
  const teacher = await signInAs(context, {
    email: "e2e-draft-teacher@example.test",
    name: "E2E Draft Teacher",
    classSlug: fixture.slug,
    teacher: true,
  });
  // A student who is *already* enrolled: "teachers only" has to mean that too.
  const studentCtx = await browser.newContext();
  const student = await signInAs(studentCtx, {
    email: "e2e-draft-student@example.test",
    name: "E2E Draft Student",
    classSlug: fixture.slug,
  });
  const anonCtx = await browser.newContext();
  page.on("dialog", (d) => d.accept()); // the confirm() on Unpublish

  const clsUrl = `/classes/${fixture.slug}`;
  const lessonUrl = `${clsUrl}/lessons/${fixture.lessonSlug}`;
  const title = new RegExp(`E2E Scratch Class ${process.pid}`);

  try {
    // --- hidden -----------------------------------------------------------
    const anonPage = await anonCtx.newPage();
    await anonPage.goto("/classes");
    await expect(anonPage.getByRole("link", { name: title })).toHaveCount(0);

    for (const [who, ctx] of [
      ["anonymous", anonCtx],
      ["enrolled student", studentCtx],
    ] as const) {
      for (const url of [clsUrl, lessonUrl]) {
        const res = await ctx.request.get(url);
        expect(res.status(), `${who} ${url}`).toBe(404);
      }
    }

    // Not offered in the student's own list either — that would be a dead link.
    const studentPage = await studentCtx.newPage();
    await studentPage.goto("/profile?tab=classes");
    await expect(studentPage.getByText(title)).toHaveCount(0);

    // A code handed out early enrolls nobody, and answers exactly what an unknown
    // code answers.
    const code = await teacher.createInvite(fixture.slug, "Draft group");
    const early = await studentCtx.request.post("/api/classes/join", { data: { code } });
    expect(early.status()).toBe(404);

    // --- the teacher's own view ------------------------------------------
    await page.goto("/classes");
    const card = page.locator("li").filter({ has: page.getByRole("link", { name: title }) });
    // Exact text: the badge, not the word wherever else it appears.
    await expect(card.locator("span.badge").filter({ hasText: /^draft$/ })).toBeVisible();
    // The list only reports the state; publishing lives on the class page, next
    // to the note explaining what it costs.
    await expect(card.getByTestId("publish-toggle")).toHaveCount(0);

    await page.goto(clsUrl);
    await expect(page.getByTestId("draft-note")).toBeVisible();
    expect(await fixture.published()).toBe(false);

    // --- publish ----------------------------------------------------------
    await page.getByTestId("publish-toggle").click();
    await expect(page.getByTestId("draft-note")).toHaveCount(0);
    await expect(page.getByTestId("publish-toggle")).toHaveText("Unpublish");
    expect(await fixture.published()).toBe(true);

    // …and the list follows.
    await page.goto("/classes");
    await expect(card.locator("span.badge").filter({ hasText: /^draft$/ })).toHaveCount(0);

    await anonPage.goto("/classes");
    await expect(anonPage.getByRole("link", { name: title })).toBeVisible();
    expect((await anonCtx.request.get(clsUrl)).status()).toBe(200);
    expect((await anonCtx.request.get(lessonUrl)).status()).toBe(200);
    // The same code now works, without anything being re-deployed.
    const join = await studentCtx.request.post("/api/classes/join", { data: { code } });
    expect(join.ok(), await join.text()).toBe(true);

    // --- and back off the site -------------------------------------------
    await page.goto(clsUrl);
    await page.getByTestId("publish-toggle").click();
    await expect(page.getByTestId("draft-note")).toBeVisible();
    expect(await fixture.published()).toBe(false);
    expect((await anonCtx.request.get(clsUrl)).status()).toBe(404);
  } finally {
    await student.dispose();
    await studentCtx.close();
    await teacher.dispose();
    await anonCtx.close();
    await fixture.dispose();
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

// The teacher writes the codes, one per group, and the homework table lists only
// the people who typed one — with the group they landed in.
test("teacher: writes a group code, and its student appears in the homework table", async ({
  page,
  context,
  browser,
}) => {
  const teacher = await signInAs(context, {
    email: "e2e-teacher@example.test",
    name: "E2E Teacher",
    classSlug: CLASS,
    teacher: true,
  });
  const code = `E2E-STREAM-${process.pid}`;
  const studentCtx = await browser.newContext();
  const student = await signInAs(studentCtx, {
    email: "e2e-grouped-student@example.test",
    name: "E2E Grouped",
  });
  try {
    await page.goto(`/classes/${CLASS}/homework`);
    await expect(page.getByRole("heading", { name: "Group codes" })).toBeVisible();

    await page.getByLabel("New code").fill(code);
    await page.getByLabel("Group name").fill("Evening stream");
    await page.getByRole("button", { name: "New code" }).click();

    const row = page.locator(".invite-list li").filter({ hasText: code });
    await expect(row).toContainText("Evening stream");
    await expect(row).toContainText("0 students");
    // Nobody has used it, so it is still disposable.
    await expect(row.getByRole("button", { name: "delete" })).toBeVisible();

    // The teacher reads the code out; the student types it.
    const studentPage = await studentCtx.newPage();
    await studentPage.goto(`/classes/${CLASS}`);
    await studentPage.locator("#class-code").fill(code);
    await studentPage.getByRole("button", { name: "Join" }).click();
    await expect(studentPage.getByText(/You are in this class as/)).toBeVisible();

    await page.reload();
    await expect(row).toContainText("1 student");
    // A code with a student behind it must not be deletable: that would erase
    // which group they belong to.
    await expect(row.getByRole("button", { name: "delete" })).toHaveCount(0);

    const table = page.locator("table.hw-table");
    const studentRow = table.locator("tr").filter({ hasText: "E2E Grouped" });
    await expect(studentRow).toContainText("Evening stream");

    // Renaming in the profile has to reach the roster: the teacher sees people
    // by User.name, which is derived from the first/last name they type.
    await studentPage.goto("/profile?tab=account");
    await expect(studentPage.getByLabel(/^First name/)).toHaveValue("E2E"); // split from the old name
    await studentPage.getByLabel(/^First name/).fill("Renamed");
    await studentPage.getByLabel(/^Last name/).fill("Student");
    await studentPage.getByRole("button", { name: "Save" }).click();
    await expect(studentPage.getByTestId("account-saved")).toBeVisible();

    await page.reload();
    await expect(table.locator("tr").filter({ hasText: "Renamed Student" })).toContainText(
      "Evening stream",
    );
  } finally {
    await student.dispose();
    await studentCtx.close();
    await teacher.deleteInviteByCode(code);
    await teacher.dispose();
  }
});

// "Finish lesson" downloads the annotated PDF to the teacher and uploads a copy
// to Vercel Blob; once that copy lands, every member gets a download link.
test("member: a published lecture PDF is offered on the lesson and class pages", async ({
  page,
  context,
}) => {
  const session = await signInAs(context, {
    email: "e2e-pdf-student@example.test",
    name: "E2E Student",
    classSlug: CLASS,
  });
  const url =
    "https://e2etest.private.blob.vercel-storage.com/classes/e2e-notes-abc123.pdf";
  // The store is private, so the raw object URL is never linked: both pages point
  // at the route that checks membership and signs a short-lived download link.
  const notes = `/api/classes/${CLASS}/lessons/${LESSON}/notes`;
  try {
    // Deliberately no "nothing is published yet" assertion first: this runs
    // against the real database, where the lesson may genuinely have been
    // delivered. The test publishes the newest session, which is the one both
    // pages show.
    await session.publishLessonPdf(LESSON, url, 4_900_000);

    await page.goto(`/classes/${CLASS}/lessons/${LESSON}`);
    const link = page.getByTestId("lecture-pdf");
    await expect(link).toHaveAttribute("href", notes);
    await expect(link).toContainText("4.7 MB");

    await page.goto(`/classes/${CLASS}`);
    await expect(page.getByRole("link", { name: "notes PDF" })).toHaveAttribute("href", notes);
  } finally {
    await session.dispose();
  }
});

// The token this route mints is a write capability on the Blob store, so it must
// never be handed to a passer-by. (Without a store configured it refuses even
// earlier, with 501 — either way, no token comes back.)
test("blob upload token: refused without a teacher session", async ({ request }) => {
  const res = await request.post("/api/blob/upload-token", {
    data: {
      type: "blob.generate-client-token",
      payload: {
        pathname: `classes/${CLASS}/${LESSON}/steal.pdf`,
        callbackUrl: "http://localhost:3000/api/blob/upload-token",
        clientPayload: JSON.stringify({ classSlug: CLASS, sessionId: "whatever" }),
        multipart: false,
      },
    },
  });
  expect(res.ok()).toBe(false);
  expect(await res.text()).not.toContain("clientToken");
});

// The bridge is how the static deck reaches @vercel/blob/client. Opened at the
// top level, window.parent is the page itself, so it can be driven directly:
// this checks the message protocol end to end and that a passer-by's upload dies
// on the token route rather than in a silent hang.
test("blob bridge: takes a Blob over postMessage and reports the refusal", async ({
  page,
}) => {
  await page.goto("/classes/blob-bridge");
  const state = page.getByTestId("blob-bridge-state");
  await expect(state).toContainText("waiting for a file");

  await page.evaluate((cls) => {
    const blob = new Blob([new Uint8Array(1024)], { type: "application/pdf" });
    window.postMessage(
      {
        type: "mlp-blob-upload",
        blob,
        pathname: `classes/${cls}/l01-intro-python/notes.pdf`,
        classSlug: cls,
        sessionId: "not-a-real-session",
      },
      location.origin,
    );
  }, CLASS);

  await expect(state).toContainText(/failed:/);
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
// canvas, and nothing that could reach the saved PDF. It draws only while the
// button is held — hovering across the deck used to paint a red streak over the
// slide. The trail behaviour is all timing, so the assertions lean on the
// mlpLaser() hook to decide *when* to look, and on pixels to decide *what* is
// there.
test("present mode: laser draws only while pressed, revives, then fades", async ({
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

  const box = (await page.locator("canvas.ink-canvas").boundingBox())!;
  const y = box.y + box.height * 0.5;

  // Hovering draws nothing at all: the pointer has to be pressed.
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + i * 0.05), y);
  }
  await page.waitForTimeout(200);
  expect((await trail()).n).toBe(0);
  expect((await laser()).down).toBe(false);

  // Sweep for well over 2 s with the button down. Nothing may expire while the
  // pointer keeps moving, so the whole span has to still be on screen at the
  // end — an age-based decay would have dropped everything older than a second.
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  expect((await laser()).down).toBe(true);
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

  // Holding still — button still down — starts the fade...
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

  // Letting go ends it: the trail fades out and moving no longer revives it.
  await page.mouse.up();
  expect((await laser()).down).toBe(false);
  await page.mouse.move(box.x + box.width * 0.4, y - 20);
  await expect
    .poll(() => trail().then((t) => t.n), { timeout: 8000, intervals: [250] })
    .toBe(0);
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(box.x + box.width * (0.3 + i * 0.05), y - 30);
  }
  await page.waitForTimeout(200);
  expect((await trail()).n).toBe(0);
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

  // Publishing runs in a hidden bridge iframe and must not be able to spoil the
  // lesson: this smoke-test session is not a real one and there is no Blob store
  // configured, so the upload is refused — the teacher still gets the file, sees
  // why it was not published, and no iframe is left behind.
  await expect(page.locator("#ink-progress")).toContainText(/Not published:/);
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

/* Practice that lives off-site — a Colab notebook, a dataset — is a `link`
 * item. It carries no progress, and the trap is that "no progress" reads as
 * "complete": flatten() drops links, and [].every() is true, so the class page
 * would tick a link the moment it rendered. Both surfaces are checked.
 *
 * Runs on a scratch class, like the draft test above, so it does not depend on
 * what any real course happens to assign this term. */
test("practice links open off-site and are never ticked as done", async ({
  page,
  context,
}) => {
  const href = "https://colab.research.google.com/github/avalur/ml-practice-tasks/blob/master/x.ipynb";
  const fixture = await draftClass({
    slug: `e2e-links-${process.pid}`,
    title: "E2E Links",
    practice: [{ type: "link", title: "Practice 1 — Colab", href }],
  });
  const teacher = await signInAs(context, {
    email: "e2e-links-teacher@example.test",
    name: "E2E Links Teacher",
    classSlug: fixture.slug,
    teacher: true,
  });
  try {
    for (const url of [
      `/classes/${fixture.slug}`,
      `/classes/${fixture.slug}/lessons/${fixture.lessonSlug}`,
    ]) {
      await page.goto(url);
      const link = page.getByRole("link", { name: /Practice 1 — Colab/ });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      // The tick is the whole point: an untracked item must not claim to be done.
      await expect(link).not.toContainText("✓");
    }
  } finally {
    await teacher.dispose();
    await fixture.dispose();
  }
});
