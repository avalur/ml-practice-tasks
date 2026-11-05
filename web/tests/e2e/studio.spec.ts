import http from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Browser, type Page } from "@playwright/test";

import { databaseUrl, isIsolatedDb, PUBLISH_SKIP_REASON, signInAs, teacherGrants } from "./support/session";
import { TEACHER_TERMS_VERSION } from "../../src/content/teacher-terms";

/* The Studio, end to end: a teacher builds a course on the site, and the rest
 * of the app treats it like any other class.
 *
 * Everything here writes rows (courses, lessons, grants), and publishing a
 * course makes it reachable by link — so the whole file runs only against an
 * isolated database, like the other publishing tests. */

const ADMIN = { email: "e2e-admin@example.test", name: "E2E Admin" };
const ORIGIN = `http://localhost:${process.env.PORT || "3000"}`;

test.skip(!isIsolatedDb(), PUBLISH_SKIP_REASON);

async function as(browser: Browser, who: { email: string; name: string }) {
  const context = await browser.newContext();
  const session = await signInAs(context, who);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "E2E note" : undefined));
  return {
    page,
    session,
    async close() {
      await session.dispose();
      await context.close();
    },
  };
}

async function db() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient({ datasourceUrl: databaseUrl() });
}

/** A teacher with the live role, and every studio course they make deleted
 * afterwards (the course outlives the user: ownerId is SetNull). */
async function teacher(browser: Browser, tag: string) {
  const email = `e2e-studio-${tag}-${process.pid}@example.test`;
  const grants = await teacherGrants();
  await grants.activate(email, TEACHER_TERMS_VERSION);
  const t = await as(browser, { email, name: `E2E Studio ${tag}` });
  return {
    ...t,
    email,
    async close() {
      const prisma = await db();
      await prisma.class.deleteMany({ where: { source: "studio", teacherEmails: { has: email } } });
      await prisma.$disconnect();
      await t.close();
      await grants.dispose();
    },
  };
}

async function createCourse(page: Page, title: string): Promise<string> {
  await page.goto("/studio");
  await page.getByTestId("new-course").locator('input[name="title"]').fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await page.waitForURL(/\/studio\/[a-z0-9-]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("studio: only active teachers get in", async ({ browser }) => {
  const visitor = await as(browser, { email: `e2e-studio-visitor-${process.pid}@example.test`, name: "Visitor" });
  try {
    await visitor.page.goto("/studio");
    await expect(visitor.page).toHaveURL(/\/teach$/);
    const res = await visitor.page.request.post("/api/studio/courses", {
      data: { title: "Sneaky" },
      headers: { origin: ORIGIN },
    });
    expect(res.status()).toBe(403);
  } finally {
    await visitor.close();
  }
});

test("studio: a course is built, published unlisted, and works like any class", async ({ browser }) => {
  const t = await teacher(browser, "course");
  const student = await as(browser, { email: `e2e-studio-student-${process.pid}@example.test`, name: "Student" });
  const admin = await as(browser, ADMIN);
  try {
    const slug = await createCourse(t.page, "E2E Linear Algebra");
    expect(slug).toMatch(/^e2e-linear-algebra-[a-z0-9]{5}$/);

    // Born a draft, with one lesson: the student cannot see it yet.
    await expect(t.page.getByTestId("lesson-list").locator("li")).toHaveCount(1);
    expect((await student.page.goto(`/classes/${slug}`))?.status()).toBe(404);

    // A second lesson, then reorder it to the front.
    await t.page.getByLabel("New lesson title").fill("Vectors");
    await t.page.getByRole("button", { name: "Add lesson" }).click();
    await expect(t.page.getByTestId("lesson-list").locator("li")).toHaveCount(2);
    await t.page.getByTestId("lesson-list").locator("li").nth(1).getByLabel("Move up").click();
    await expect(t.page.getByTestId("lesson-list").locator("li").first()).toContainText("Vectors");

    // Pick tasks: one in class, a whole topic as homework.
    await t.page.getByTestId("lesson-list").locator("li").first().getByRole("link").click();
    await t.page.getByLabel("Find a task").fill("fizz");
    await t.page.getByTestId("result-py_basics/fizz_buzz").getByRole("button", { name: "+ in class" }).click();
    await t.page.getByLabel("Find a task").fill("py_strings/*");
    await t.page.locator(".studio-result").first().getByRole("button", { name: "+ homework" }).click();
    await t.page.locator('input[name="homework-due"]').fill("2026-12-01");
    await t.page.getByTestId("save-items").click();
    await expect(t.page.getByTestId("items-part").getByText("Saved.")).toBeVisible();
    const lessonSlug = new URL(t.page.url()).pathname.split("/").pop()!;
    expect(lessonSlug).toMatch(/^l02-vectors$/);

    // An unknown task is refused by the route, not stored.
    const bad = await t.page.request.patch(`/api/studio/courses/${slug}/lessons/${lessonSlug}`, {
      data: { practice: [{ type: "problem", id: "py_basics/no_such_task" }] },
      headers: { origin: ORIGIN },
    });
    expect(bad.status()).toBe(400);

    // Publish: reachable by link, but not listed on /classes.
    await t.page.goto(`/studio/${slug}`);
    await t.page.getByTestId("publish-toggle").click();
    await expect(t.page.getByTestId("publish-toggle")).toHaveText("Unpublish");
    expect((await student.page.goto(`/classes/${slug}`))?.status()).toBe(200);
    await expect(student.page.getByRole("heading", { name: "E2E Linear Algebra" })).toBeVisible();
    await student.page.goto("/classes");
    await expect(student.page.getByText("E2E Linear Algebra")).toHaveCount(0);

    // The lesson page shows the picked task and the expanded topic.
    await student.page.goto(`/classes/${slug}/lessons/${lessonSlug}`);
    await expect(student.page.getByRole("link", { name: /py_basics\/fizz_buzz/ })).toBeVisible();
    await expect(student.page.locator(".ref-group summary code")).toHaveText("py_strings/*");

    // A site admin lists it; now /classes shows it.
    await admin.page.goto(`/classes/${slug}`);
    await admin.page.getByTestId("feature-toggle").click();
    await expect(admin.page.getByTestId("feature-toggle")).toHaveText("Unlist from /classes");
    await student.page.goto("/classes");
    await expect(student.page.getByText("E2E Linear Algebra")).toBeVisible();

    // Another teacher's course is not editable — 404, not 403, so it does not
    // even confirm the slug.
    const other = await teacher(browser, "other");
    try {
      expect((await other.page.goto(`/studio/${slug}`))?.status()).toBe(404);
      const res = await other.page.request.patch(`/api/studio/courses/${slug}`, {
        data: { title: "Hijacked" },
        headers: { origin: ORIGIN },
      });
      expect(res.status()).toBe(404);
    } finally {
      await other.close();
    }
  } finally {
    await student.close();
    await admin.close();
    await t.close();
  }
});

test("studio: slides are sanitized, served under a CSP, and present like a repo deck", async ({ browser }) => {
  const t = await teacher(browser, "deck");
  try {
    const slug = await createCourse(t.page, "E2E Deck");
    const lessonSlug = "l01-intro";
    await t.page.goto(`/studio/${slug}/${lessonSlug}`);

    const deck =
      `<section><h2>Gradient descent</h2><p>Step: $w \\leftarrow w - \\eta \\nabla L$</p>` +
      `<script>window.__pwned = 1</script><img src="https://tracker.example/p.gif" alt="t">` +
      `<form action="https://evil.example"><input name="password"></form></section>` +
      `<section><h3>Second</h3><p onclick="window.__pwned = 2">click</p></section>`;
    const save = await t.page.request.patch(`/api/studio/courses/${slug}/lessons/${lessonSlug}`, {
      data: { deck },
      headers: { origin: ORIGIN },
    });
    expect(save.status()).toBe(200);
    const saved = await save.json();
    expect(saved.stripped).toBe(true);
    for (const gone of ["<script", "tracker.example", "<form", "<input", "onclick"]) {
      expect(saved.deck).not.toContain(gone);
    }

    // The page itself: CSP with a nonce, the slides, reveal running, nothing executed.
    const res = await t.page.goto(`/classes/${slug}/${lessonSlug}/present.html`);
    expect(res?.status()).toBe(200);
    const csp = res!.headers()["content-security-policy"];
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("form-action 'none'");
    await t.page.waitForFunction(() => (window as any).Reveal?.isReady?.());
    await expect(t.page.locator(".reveal .slides > section")).toHaveCount(2);
    await expect(t.page.locator(".reveal .slides > section").first().locator(".katex")).toHaveCount(1);
    expect(await t.page.evaluate(() => (window as any).__pwned)).toBeUndefined();

    // A draft deck is the teacher's alone.
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    expect((await anonPage.goto(`${ORIGIN}/classes/${slug}/${lessonSlug}/present.html`))?.status()).toBe(404);
    await anon.close();

    // Images: uploaded, sniffed, served same-origin.
    await t.page.goto(`/studio/${slug}/${lessonSlug}`);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await t.page.getByTestId("image-input").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: png });
    await expect(t.page.getByTestId("deck-msg")).toContainText("Image uploaded");
    const editorText = await t.page.locator(".cm-content").innerText();
    const assetUrl = /\/api\/studio\/assets\/[a-z0-9]+/.exec(editorText)?.[0];
    expect(assetUrl).toBeTruthy();
    const img = await t.page.request.get(assetUrl!);
    expect(img.headers()["content-type"]).toBe("image/png");

    // A text file pretending to be an image is refused by its bytes.
    const fake = await t.page.request.post(`/api/studio/courses/${slug}/assets`, {
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") } },
      headers: { origin: ORIGIN },
    });
    expect(fake.status()).toBe(415);
  } finally {
    await t.close();
  }
});

// The CSP must not break present mode itself: the ink layer, KaTeX, the theme
// fonts and "Finish lesson" (html2canvas + jsPDF + the bridge iframe) all run
// under it on a studio deck, with not one violation reported.
test("studio: present mode and Finish lesson work under the deck's CSP", async ({ browser }) => {
  test.slow();
  const t = await teacher(browser, "present");
  try {
    const slug = await createCourse(t.page, "E2E Present");
    const violations: string[] = [];
    t.page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });

    await t.page.goto(`/classes/${slug}/l01-intro/present.html?session=smoke-test`);
    await t.page.waitForFunction(() => (window as any).Reveal?.isReady?.());
    const slides = await t.page.evaluate(() => (window as any).Reveal.getSlides().length);
    expect(slides).toBe(2); // the starter deck

    await t.page.keyboard.press("d");
    const box = (await t.page.locator("canvas.ink-canvas").boundingBox())!;
    await t.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await t.page.mouse.down();
    await t.page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await t.page.mouse.up();

    const downloadPromise = t.page.waitForEvent("download", { timeout: 120_000 });
    await t.page.getByRole("button", { name: "Finish lesson" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`^${slug}-l01-intro-\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(Number(/\/Count (\d+)/.exec(bytes.toString("latin1"))?.[1])).toBe(slides);
    // The bridge iframe ran (and was refused for want of a store) under frame-src 'self'.
    await expect(t.page.locator("#ink-progress")).toContainText(/Not published:/);

    expect(violations).toEqual([]);
  } finally {
    await t.close();
  }
});

// The one script a studio deck may run: PyScript editors, under the deck's CSP,
// sharing variables across slides through env= exactly like a repo deck.
test("studio: py-editors run in a studio deck under its CSP", async ({ browser }) => {
  test.setTimeout(240_000);
  const t = await teacher(browser, "python");
  try {
    const slug = await createCourse(t.page, "E2E Python");
    const deck =
      `<section><h2>Run me</h2><script type="py-editor" env="shared" setup>\nx = 6 * 7\nprint("answer", x)\n</script></section>\n` +
      `<section><h2>Again</h2><script type="py-editor" env="shared">\nprint("again", x + 1)\n</script></section>`;
    const save = await t.page.request.patch(`/api/studio/courses/${slug}/lessons/l01-intro`, {
      data: { deck },
      headers: { origin: ORIGIN },
    });
    expect(save.status()).toBe(200);
    expect((await save.json()).deck).not.toContain("setup"); // no auto-run

    const violations: string[] = [];
    t.page.on("console", (m) => {
      if (/Content Security Policy|Refused to|EvalError/i.test(m.text())) violations.push(m.text());
    });
    const res = await t.page.goto(`/classes/${slug}/l01-intro/present.html`);
    expect(res!.headers()["content-security-policy"]).toContain("https://pyscript.net");
    const run = t.page.locator(".py-editor-run-button");
    await expect(run).toHaveCount(2, { timeout: 60_000 });
    const out = t.page.locator(".py-editor-output");
    // Nothing ran on its own.
    await expect(out.first()).toHaveText("");

    await run.first().click({ force: true });
    await expect(out.first()).toContainText("answer 42", { timeout: 180_000 });
    await t.page.evaluate(() => (window as any).Reveal.slide(1));
    await run.nth(1).click({ force: true });
    await expect(out.nth(1)).toContainText("again 43", { timeout: 60_000 });
    expect(violations).toEqual([]);

    // A deck without editors keeps the strict policy: no eval, no CDN.
    await t.page.request.patch(`/api/studio/courses/${slug}/lessons/l01-intro`, {
      data: { deck: "<section><h2>Plain</h2></section>" },
      headers: { origin: ORIGIN },
    });
    const plain = await t.page.request.get(`/classes/${slug}/l01-intro/present.html`);
    expect(plain.headers()["content-security-policy"]).not.toMatch(/unsafe-eval|pyscript/);
    expect(await plain.text()).not.toContain("pyscript.net");
  } finally {
    await t.close();
  }
});

/** Replace everything in the page's CodeMirror, as a paste — typing would let
 * the HTML mode auto-close every tag. */
async function pasteDeck(page: Page, text: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.locator(".cm-content").evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test("studio: the full-screen editor renders unsaved slides live, on the cursor's slide", async ({ browser }) => {
  const t = await teacher(browser, "fullscreen");
  try {
    const slug = await createCourse(t.page, "E2E Fullscreen");
    const lessonSlug = "l01-intro";
    const violations: string[] = [];
    t.page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    await t.page.goto(`/studio/${slug}/${lessonSlug}`);
    await t.page.getByTestId("open-fullscreen").click();
    await expect(t.page.getByTestId("deck-fullscreen")).toBeVisible();
    // The page's own preview iframe is gone; the overlay's live one replaces it.
    await expect(t.page.getByTestId("deck-preview")).toHaveCount(0);
    const front = () => t.page.frameLocator('[data-testid="fs-preview-front"]');
    await expect(front().locator(".reveal .slides > section")).toHaveCount(2); // the starter deck

    await pasteDeck(
      t.page,
      `<section><h2>Alpha slide</h2></section>\n<section><h2>Beta slide $x^2$</h2>` +
        `<script>window.top.__pwned = 1</script></section>\n<section><h2>Gamma slide</h2></section>`,
    );
    // Rendered from the unsaved text, through the same sanitizer and shell.
    await expect(front().locator(".reveal .slides > section")).toHaveCount(3);
    await expect(front().locator(".reveal .slides > section").nth(1).locator(".katex")).toHaveCount(1);
    await expect(front().locator("script:not([src]):not([nonce])")).toHaveCount(0);
    expect(await t.page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    await expect(t.page.getByTestId("save-deck")).toHaveText("Save slides");

    // The preview follows the cursor: end of the text is the last slide, then
    // a click inside the second one shows the second.
    const indexH = () =>
      t.page.locator('[data-testid="fs-preview-front"]').evaluate((f) => ((f as HTMLIFrameElement).contentWindow as any).Reveal.getIndices().h);
    await t.page.locator(".cm-content").click();
    await t.page.keyboard.press("ControlOrMeta+End");
    await expect.poll(indexH).toBe(2);
    await t.page.locator(".cm-content").getByText("Beta slide").click();
    await expect.poll(indexH).toBe(1);
    await expect(t.page.getByTestId("deck-fullscreen")).toContainText("slide 2");

    // Fragments are all shown in the editor's preview.
    await pasteDeck(t.page, `<section><h2>One</h2></section>\n<section><ul><li class="fragment">Hidden in Present</li></ul></section>`);
    await t.page.locator(".cm-content").getByText("Hidden in Present").click();
    await expect(front().locator(".reveal li", { hasText: "Hidden in Present" })).toBeVisible();

    // ⌘S / Ctrl+S saves from the overlay.
    await t.page.keyboard.press("ControlOrMeta+s");
    await expect(t.page.getByTestId("save-deck")).toHaveText("Saved");

    await t.page.getByTestId("fs-exit").click();
    await expect(t.page.getByTestId("deck-fullscreen")).toHaveCount(0);
    await expect(t.page.frameLocator('[data-testid="deck-preview"]').locator(".reveal .slides > section")).toHaveCount(2);
    expect(violations).toEqual([]);

    // The preview renders for the course's editors only, and only same-origin.
    const anon = await browser.newContext();
    const r1 = await anon.request.post(`${ORIGIN}/api/studio/courses/${slug}/lessons/${lessonSlug}/preview`, {
      form: { deck: "<section>hi</section>" },
    });
    expect(r1.status()).toBe(401);
    await anon.close();
    const r2 = await t.page.request.post(`/api/studio/courses/${slug}/lessons/${lessonSlug}/preview`, {
      form: { deck: "<section>hi</section>" },
      headers: { origin: "https://evil.example" },
    });
    expect(r2.status()).toBe(403);
  } finally {
    await t.close();
  }
});

/** Point the teacher's "own key" at a mock model on localhost. */
async function saveOwnKey(page: Page, port: number) {
  await page.goto("/studio/settings");
  await page.locator('select[name="provider"]').selectOption("custom");
  await page.locator('input[name="baseUrl"]').fill(`http://127.0.0.1:${port}/v1`);
  await page.locator('input[name="model"]').fill("mock-model");
  await page.locator('input[name="key"]').fill("sk-e2e-secret-1234");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByTestId("ai-key-status")).toContainText("mock-model");
}

test("studio: the AI builder uses the teacher's own key and its answer is sanitized", async ({ browser }) => {
  test.skip(process.env.AI_ALLOW_PRIVATE_BASE_URL !== "1", "needs AI_ALLOW_PRIVATE_BASE_URL=1 on the server for the mock model");
  const requests: { model: string; stream?: boolean; reasoning?: unknown; messages: { role: string; content: string }[] }[] = [];
  const mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      requests.push(JSON.parse(body));
      const content =
        "Here you go:\n```html\n<section><h2>Mock slide one</h2><script>alert(1)</script></section>\n" +
        "<section><h2>Mock slide two</h2></section>\n" +
        // Later requests change the deck, so the chat's answer is a visible edit.
        (requests.length > 1 ? "<section><h2>Cross product</h2></section>\n" : "") +
        "```";
      if (requests.length === 1) {
        // A provider that ignores `stream` and answers plain JSON still works.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
        return;
      }
      // Later ones stream like OpenRouter: a keep-alive comment, reasoning,
      // then the answer in pieces with pauses the editor can be watched in.
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const send = (delta: object) => res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
      const pause = () => new Promise((r) => setTimeout(r, 700));
      res.write(": OPENROUTER PROCESSING\n\n");
      send({ reasoning: "The teacher wants a cross product slide. " });
      await pause();
      send({ reasoning: "I will append it after the existing two." });
      await pause();
      const cut = content.indexOf("<section><h2>Cross");
      send({ content: content.slice(0, cut) });
      await pause();
      await pause();
      send({ content: content.slice(cut) });
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", r));
  const port = (mock.address() as AddressInfo).port;

  const t = await teacher(browser, "ai");
  try {
    const slug = await createCourse(t.page, "E2E AI");

    // No platform model in this environment and no own key yet: a clear refusal.
    const none = await t.page.request.post("/api/studio/ai", {
      data: { course: slug, lesson: "l01-intro", mode: "generate", prompt: "Intro to vectors" },
      headers: { origin: ORIGIN },
    });
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) expect(none.status()).toBe(501);

    await saveOwnKey(t.page, port);
    await expect(t.page.getByTestId("ai-key-status")).toContainText("…1234");

    // The key is stored encrypted, never in the clear.
    const prisma = await db();
    const cred = await prisma.aiCredential.findFirstOrThrow({ where: { user: { email: t.email } } });
    expect(cred.keyCipher).not.toContain("sk-e2e-secret");
    await prisma.$disconnect();

    await t.page.goto(`/studio/${slug}/l01-intro`);
    await t.page.getByTestId("ai-open").click();
    await t.page.getByLabel("AI request").fill("Vectors: definition, addition, dot product");
    await t.page.getByTestId("ai-run").click();
    await expect(t.page.getByTestId("ai-msg")).toContainText("your key");
    const text = await t.page.locator(".cm-content").innerText();
    expect(text).toContain("Mock slide one");
    expect(text).toContain("Mock slide two");
    expect(text).not.toContain("<script");
    expect(text).not.toContain("Here you go");

    // The model got our dialect instructions and the teacher's request.
    expect(requests.at(-1)?.model).toBe("mock-model");
    expect(requests.at(-1)?.messages[0].content).toContain("<section>");
    expect(requests.at(-1)?.messages[1].content).toContain("dot product");

    // Not saved until the teacher saves.
    await t.page.getByTestId("save-deck").click();
    await expect(t.page.getByTestId("save-deck")).toHaveText("Saved");

    // In full screen the same AI is a chat in the left column.
    await t.page.getByTestId("open-fullscreen").click();
    // The chat is open by default; the AI button folds it away and back.
    await expect(t.page.getByTestId("fs-chat")).toBeVisible();
    await t.page.getByTestId("fs-ai").click();
    await expect(t.page.getByTestId("fs-chat")).toHaveCount(0);
    await t.page.getByTestId("fs-ai").click();
    await t.page.getByTestId("fs-chat-input").fill("Add a slide about the cross product");
    await t.page.getByTestId("fs-chat-input").press("Enter");
    await expect(t.page.getByTestId("fs-chat-log")).toContainText("Add a slide about the cross product");
    // While it runs, the chat shows the model thinking, then the slides it has finished.
    const live = t.page.getByTestId("ai-progress");
    await expect(live).toContainText("I will append it after the existing two");
    await expect(live).toContainText("Writing slides — 2 done");
    await expect(live.locator("li")).toHaveText(["Mock slide one", "Mock slide two"]);
    await expect(live).toHaveCount(0);
    expect(requests.at(-1)?.stream).toBe(true);
    // `reasoning` is an OpenRouter extension; a custom endpoint never gets it.
    expect(requests.at(-1)?.reasoning).toBeUndefined();
    await expect(t.page.getByTestId("fs-chat-log")).toContainText("3 slides");
    expect(requests.at(-1)?.messages.at(-1)?.content).toContain("cross product");
    await expect(t.page.getByTestId("save-deck")).toHaveText("Save slides");
    // The live preview has it (on its own slide — the preview stays on the cursor's).
    await expect(
      t.page.frameLocator('[data-testid="fs-preview-front"]').locator(".reveal .slides > section h2", { hasText: "Cross product" }),
    ).toHaveCount(1);
    // Undo puts back exactly what was there before the request.
    await t.page.getByTestId("fs-chat-log").getByRole("button", { name: "Undo this change" }).click();
    await expect(t.page.getByTestId("save-deck")).toHaveText("Saved");
  } finally {
    await t.close();
    mock.close();
  }
});

test("studio: a lesson linked in the AI chat is copied exactly, images, data and packages included", async ({ browser }) => {
  test.skip(process.env.AI_ALLOW_PRIVATE_BASE_URL !== "1", "needs AI_ALLOW_PRIVATE_BASE_URL=1 on the server for the mock model");
  test.setTimeout(300_000);
  // The model is shown the lesson and answers with one reference to it — the
  // short answer SOURCE_RULES asks for when the teacher only wants a copy.
  const requests: { messages: { role: string; content: string }[] }[] = [];
  const mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      requests.push(JSON.parse(body));
      const sees = requests.at(-1)!.messages.some((m) => m.content.includes("<source-deck>"));
      await new Promise((r) => setTimeout(r, 1500)); // long enough to watch the progress
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: sees ? "<copy-source/>" : "<section><h2>Invented</h2></section>" } }] }));
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", r));
  const port = (mock.address() as AddressInfo).port;

  const SRC = "/classes/ml-intensive-tlf/l02-numpy-pandas/present.html";
  const t = await teacher(browser, "copy");
  try {
    const slug = await createCourse(t.page, "E2E Copy");
    await saveOwnKey(t.page, port);

    // What the published lesson has, to compare the copy against.
    const source = await t.page.request.get(SRC).then((r) => r.text());
    const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
    const slidesHtml = source.slice(source.indexOf('<div class="slides">'));
    const want = { sections: count(slidesHtml, /<section\b/g), editors: count(slidesHtml, /<script type="py-editor"/g) };
    expect(want.editors).toBeGreaterThan(20);

    await t.page.goto(`/studio/${slug}/l01-intro`);
    await t.page.getByTestId("open-fullscreen").click();
    await t.page.getByRole("radio", { name: "New deck" }).click();
    // The teacher's own words, with the production address: it is still this site.
    await t.page.getByTestId("fs-chat-input").fill(`Можешь сделать тут копию вот этих слайдов, включая картинки? https://www.mlpractice.com${SRC}`);
    await t.page.getByTestId("fs-chat-input").press("Enter");
    await expect(t.page.getByTestId("ai-source")).toContainText("Lecture 2. NumPy and Pandas");
    await expect(t.page.getByTestId("ai-source")).toContainText("4 images, 2 data files");
    await expect(t.page.getByTestId("ai-progress")).toHaveCount(0, { timeout: 30_000 });
    await expect(t.page.getByTestId("fs-chat-log")).toContainText(`${want.sections} slides`);
    // The model was given the real slides, numbered, and told how to refer to them.
    const prompt = requests.at(-1)!.messages.at(-1)!.content;
    expect(prompt).toContain("<!-- slide 1 -->");
    expect(prompt).toContain("<copy-source/>");
    expect(prompt).toContain("genfromtxt('example.csv'");
    await t.page.keyboard.press("ControlOrMeta+S");
    await expect(t.page.getByTestId("save-deck")).toHaveText("Saved");
    await t.page.getByTestId("fs-exit").click();

    const prisma = await db();
    const cls = await prisma.class.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    const { deck } = await prisma.studioLesson.findUniqueOrThrow({
      where: { classId_slug: { classId: cls.id, slug: "l01-intro" } },
      select: { deck: true },
    });
    const assets = await prisma.studioAsset.findMany({ where: { classId: cls.id }, select: { id: true, name: true, mime: true } });
    await prisma.$disconnect();
    expect(count(deck, /<section\b/g)).toBe(want.sections);
    expect(count(deck, /<script type="py-editor"/g)).toBe(want.editors);
    expect(deck).not.toContain("/classes/ml-intensive-tlf/assets/");
    expect(deck).toContain('class="important" style="color:orange"'); // the deck's own CSS, inlined
    expect(assets.map((a) => a.mime).sort()).toEqual(["image/gif", "image/gif", "image/png", "image/webp", "text/csv", "text/csv"]);
    for (const a of assets) expect(deck).toContain(`/api/studio/assets/${a.id}`);
    // The toml config became an inline one, pointing at the copied data files.
    const csv = assets.find((a) => a.name === "example.csv")!;
    expect(deck).toContain(`env="read" config='{"packages":["numpy","pandas"],"files":{`);
    expect(deck).toContain(`"/api/studio/assets/${csv.id}":"example.csv"`);

    // Asking again copies nothing twice.
    const again = await t.page.request.post("/api/studio/ai", {
      data: { course: slug, lesson: "l01-intro", mode: "generate", prompt: `copy ${SRC}` },
      headers: { origin: ORIGIN },
    });
    expect(again.status()).toBe(200);
    await again.text();
    const prisma2 = await db();
    expect(await prisma2.studioAsset.count({ where: { classId: cls.id } })).toBe(assets.length);
    await prisma2.$disconnect();

    // Every picture loads, and the editor that reads example.csv runs with
    // numpy under the deck's CSP.
    const violations: string[] = [];
    t.page.on("console", (m) => {
      if (/Content Security Policy|Refused to|EvalError/i.test(m.text())) violations.push(m.text());
    });
    await t.page.goto(`/classes/${slug}/l01-intro/present.html`);
    const broken = await t.page.evaluate(async () => {
      const urls = [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")!);
      const bad: string[] = [];
      for (const u of urls) {
        const r = await fetch(u);
        if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) bad.push(u);
      }
      return { n: urls.length, bad };
    });
    expect(broken.n).toBeGreaterThan(0);
    expect(broken.bad).toEqual([]);
    const run = t.page.locator(".py-editor-run-button");
    await expect(run).toHaveCount(want.editors, { timeout: 90_000 });
    // PyScript replaces each <script> with its editor box, in order — so the
    // editor's place in the saved deck is its place on the page.
    const k = deck.split('<script type="py-editor"').slice(1).findIndex((e) => e.includes("genfromtxt('example.csv'"));
    expect(k).toBeGreaterThanOrEqual(0);
    await t.page.evaluate((i) => {
      const R = (window as any).Reveal;
      const at = R.getIndices(document.querySelectorAll(".py-editor-box")[i].closest("section"));
      R.slide(at.h, at.v);
    }, k);
    await run.nth(k).click({ force: true });
    // The first rows of example.csv, as numpy prints them: "[1. 2. 3.]".
    await expect(t.page.locator(".py-editor-output").nth(k)).toContainText(/\[\s*-?\d+\.\s/, { timeout: 240_000 });
    await expect(t.page.locator(".py-editor-output").nth(k)).not.toContainText("Error");
    expect(violations).toEqual([]);
  } finally {
    await t.close();
    mock.close();
  }
});

test("studio: a task proposal is checked in the browser and reaches the admin", async ({ browser }) => {
  test.setTimeout(240_000);
  const t = await teacher(browser, "proposal");
  const admin = await as(browser, ADMIN);
  const slug = `e2e_running_sum_${process.pid}`;
  try {
    await t.page.goto("/studio/proposals");
    const form = t.page.getByTestId("proposal-form");
    await form.locator('input[name="title"]').fill("Running total");
    await form.locator('input[name="topic"]').fill("py_basics");
    await form.locator('input[name="slug"]').fill(slug);
    await form.locator('textarea[name="statement"]').fill("Return the sum of `xs` without using `sum`.");
    // Sending is locked until the check has passed.
    await expect(t.page.getByTestId("proposal-send")).toBeDisabled();
    await t.page.getByTestId("proposal-check").click();
    await expect(t.page.getByTestId("proposal-check-result")).toContainText("Reference: 6/6 tests pass", {
      timeout: 180_000,
    });
    await expect(t.page.getByTestId("proposal-check-result")).toContainText("fails, as it should");
    await t.page.getByTestId("proposal-send").click();
    await expect(t.page.getByTestId("my-proposals")).toContainText("pending");

    await admin.page.goto("/admin/proposals");
    const card = admin.page.getByTestId(`proposal-${slug}`);
    await expect(card).toContainText("reference 6/6, stub fails");
    await card.getByTestId("accept").click();
    await expect(card).toHaveCount(0);
    await t.page.reload();
    await expect(t.page.getByTestId("my-proposals")).toContainText("accepted");
  } finally {
    const prisma = await db();
    await prisma.problemProposal.deleteMany({ where: { slug } });
    await prisma.$disconnect();
    await admin.close();
    await t.close();
  }
});
