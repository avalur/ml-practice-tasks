import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import { signInAs, teaserState } from "./support/session";

/* The abacus board is client-side — no account, no database — but *seeing* it is
 * gated: the puzzle is a draft until an editor publishes it.
 *
 * So the board tests sign in as a site editor and read the draft, which touches
 * no state at all. ADMIN_EMAILS in .env.local must list this address; it is a
 * synthetic one, and there is no OAuth account behind it. Only the last test
 * flips the real row, and it puts it back.
 */
const ADMIN = { email: "e2e-admin@example.test", name: "E2E Admin" };

const cell = (page: Page, theme: string, index: number) =>
  page.getByTestId(`abacus-cell-${theme}-${index}`);

async function asEditor(context: BrowserContext) {
  const session = await signInAs(context, ADMIN);
  return session;
}

test("abacus: the cheap problem of each theme is open, the dearer ones are locked", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    await page.goto("/brainteasers/abacus");

    await expect(page.locator(".abacus-cell")).toHaveCount(9);
    for (const theme of ["geometry", "combinatorics", "numbers"]) {
      await expect(cell(page, theme, 0)).toHaveAttribute("data-state", "open");
      await expect(cell(page, theme, 1)).toHaveAttribute("data-state", "locked");
      await expect(cell(page, theme, 2)).toHaveAttribute("data-state", "locked");
      await expect(cell(page, theme, 1)).toBeDisabled();
    }
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 0 of 9");

    // An open cell shows its statement; this board's 10s are all written.
    await cell(page, "combinatorics", 0).click();
    await expect(page.getByTestId("abacus-detail")).toContainText(
      "two people with the same number of friends",
    );
  } finally {
    await editor.dispose();
  }
});

test("abacus: handing one in opens the next cell of that theme only, and survives a reload", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    await page.goto("/brainteasers/abacus");

    await cell(page, "geometry", 0).click();
    await page.getByTestId("abacus-hand-in").click();

    await expect(cell(page, "geometry", 0)).toHaveAttribute("data-state", "done");
    await expect(cell(page, "geometry", 1)).toHaveAttribute("data-state", "open");
    await expect(cell(page, "geometry", 2)).toHaveAttribute("data-state", "locked");
    // The other themes are untouched — the rule is per theme.
    await expect(cell(page, "numbers", 1)).toHaveAttribute("data-state", "locked");
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 1 of 9");

    await page.reload();
    await expect(cell(page, "geometry", 1)).toHaveAttribute("data-state", "open");
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 1 of 9");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(cell(page, "geometry", 0)).toHaveAttribute("data-state", "open");
    await expect(cell(page, "geometry", 1)).toHaveAttribute("data-state", "locked");
  } finally {
    await editor.dispose();
  }
});

test("abacus: a problem can differ by age group — the cube is Nightmare's alone", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    await page.goto("/brainteasers/abacus?lang=ru");
    const detail = page.getByTestId("abacus-detail");

    for (const [level, cube] of [
      ["extreme", false],
      ["nightmare", true],
    ] as const) {
      await page.getByTestId(`abacus-level-${level}`).click();
      // The 20 sits behind the 10 in its theme.
      await cell(page, "geometry", 0).click();
      if (cube) {
        // The same pit the middle group meets as a 30 is the oldest group's 10 —
        // one problem, two costs.
        await expect(detail).toContainText("яма глубиной 1 км");
        await expect(detail).toContainText("наименьшей длине верёвки");
      }
      await page.getByTestId("abacus-hand-in").click();
      await cell(page, "geometry", 1).click();
      await expect(detail).toContainText("сбежавшая мартышка");
      await expect(detail.getByText("для куба")).toHaveCount(cube ? 1 : 0);

      // The ants and the two powers are the same on both of these boards.
      await cell(page, "combinatorics", 0).click();
      await expect(detail).toContainText("100 одинаковых муравьёв");
      await cell(page, "algebra", 0).click();
      await expect(detail).toContainText("Что больше");
    }
  } finally {
    await editor.dispose();
  }
});

test("abacus: each difficulty is its own board, with its own progress", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    await page.goto("/brainteasers/abacus");
    await expect(page.getByTestId("abacus-level-hard")).toHaveAttribute("aria-selected", "true");

    await cell(page, "geometry", 0).click();
    await page.getByTestId("abacus-hand-in").click();
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 1 of 9");

    // Switching age group starts from scratch — a different set of problems.
    await page.getByTestId("abacus-level-nightmare").click();
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 0 of 9");
    await expect(cell(page, "geometry", 0)).toHaveAttribute("data-state", "open");
    await expect(page.getByRole("link", { name: /Print statements/ })).toHaveAttribute(
      "href",
      "/brainteasers/abacus/print?lang=en&level=nightmare",
    );

    // The choice, and each board's own progress, survive a reload.
    await page.reload();
    await expect(page.getByTestId("abacus-level-nightmare")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 0 of 9");
    await page.getByTestId("abacus-level-hard").click();
    await expect(page.getByTestId("abacus-progress")).toHaveText("Handed in 1 of 9");
  } finally {
    await editor.dispose();
  }
});

test("abacus: an authored statement renders as markdown with KaTeX, in both languages", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    // Fixed theme: the figure's colour is asserted below.
    await page.addInitScript(() => localStorage.setItem("mlp:theme", "dark"));
    await page.goto("/brainteasers/abacus");
    await cell(page, "numbers", 0).click();

    const detail = page.getByTestId("abacus-detail");
    await expect(detail).toContainText("Prove that every natural number");
    // The display formula is real KaTeX, not the raw $$…$$ it was written as.
    await expect(detail.locator(".katex")).not.toHaveCount(0);
    await expect(detail).not.toContainText("$$");

    await page.getByRole("button", { name: "RU" }).click();
    await expect(detail).toContainText("Докажите, что любое натуральное число");
    await expect(detail.locator(".katex")).not.toHaveCount(0);

    // A problem set for two age groups shows up on both boards. Hard comes last
    // so the cell stays selected for the figure checks below — switching level
    // clears the selection, the boards being different games.
    for (const level of ["extreme", "hard"] as const) {
      await page.getByTestId(`abacus-level-${level}`).click();
      await cell(page, "geometry", 0).click();
      await expect(detail).toContainText("Какое максимальное число плиток");
      // …but the older group is also asked to justify the number.
      const prove = detail.getByText("Приведите пример и докажите");
      await expect(prove).toHaveCount(level === "extreme" ? 1 : 0);
    }

    // The TikZ drawing is inlined as SVG, and its strokes are currentColor —
    // that is what makes one figure serve the dark theme, the light theme and
    // the printed sheet. A fixed #000 would vanish on the dark board.
    const svg = detail.locator("svg.tikz-figure");
    await expect(svg).toHaveCount(1);
    await expect(svg.locator("[stroke]").first()).toHaveAttribute("stroke", "currentColor");
    await expect
      .poll(() =>
        svg.locator("path").first().evaluate((el) => getComputedStyle(el).stroke),
      )
      .toBe("rgb(230, 232, 236)"); // --text, dark theme

    // A drawing with words in it is built once per language, so the two boards
    // must not be handed the same SVG. dvisvgm turns glyphs into paths, so there
    // is no text to read back — comparing the markup is the check available.
    // The 30 is behind the rule, so hand in the cheaper two to reach it.
    await page.getByTestId("abacus-hand-in").click();
    await cell(page, "geometry", 1).click();
    await page.getByTestId("abacus-hand-in").click();
    await cell(page, "geometry", 2).click();
    await expect(detail).toContainText("яма глубиной 1 км");
    const ru = await detail.locator("svg.tikz-figure").innerHTML();
    await page.getByRole("button", { name: "EN" }).click();
    await expect(detail).toContainText("a pit 1 km deep");
    const en = await detail.locator("svg.tikz-figure").innerHTML();
    expect(ru.length).toBeGreaterThan(1000);
    expect(ru).not.toBe(en);
    await page.getByRole("button", { name: "RU" }).click();

    // And it reaches the printed sheet the same way.
    await page.goto("/brainteasers/abacus/print?lang=ru&level=hard");
    const printed = page
      .locator(".abacus-print-problem")
      .filter({ hasText: "любое натуральное число" });
    await expect(printed).toHaveCount(1);
    await expect(printed.locator(".katex")).not.toHaveCount(0);
  } finally {
    await editor.dispose();
  }
});

test("abacus: the RU/EN switch swaps the board's language and is remembered", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    await page.goto("/brainteasers/abacus");
    await expect(page.getByRole("heading", { name: "Math Abacus" })).toBeVisible();
    await expect(page.getByTestId("abacus-level-hard")).toContainText("ages 10–12");

    await page.getByRole("button", { name: "RU" }).click();
    await expect(page.getByRole("heading", { name: "Математическая абака" })).toBeVisible();
    await expect(page.locator(".abacus-theme").first()).toHaveText("Геометрия");
    await expect(page.getByTestId("abacus-level-hard")).toContainText("10–12 лет");
    // The print link carries the choice over to the sheet.
    await expect(page.getByRole("link", { name: /Печать условий/ })).toHaveAttribute(
      "href",
      "/brainteasers/abacus/print?lang=ru&level=hard",
    );

    await page.reload();
    await expect(page.getByRole("heading", { name: "Математическая абака" })).toBeVisible();

    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.locator(".abacus-theme").first()).toHaveText("Geometry");
  } finally {
    await editor.dispose();
  }
});

test("abacus: the print sheet lists every problem, in the language asked for", async ({
  page,
  context,
}) => {
  const editor = await asEditor(context);
  try {
    // Dark mode on purpose: printing must not depend on how the site is themed.
    await page.addInitScript(() => localStorage.setItem("mlp:theme", "dark"));
    await page.goto("/brainteasers/abacus/print?lang=ru&level=extreme");

    await expect(page.getByRole("heading", { name: "Математическая абака · Extreme" })).toBeVisible();
    await expect(page.getByText("13–15 лет")).toBeVisible();
    const blocks = page.locator(".abacus-print-problem");
    await expect(blocks).toHaveCount(9);

    // Several figures land on one page here, and dvisvgm numbers its glyph
    // definitions per file: two of them defining `#g0-48` means the first wins
    // for everybody and a digit is quietly drawn in the wrong font. The builder
    // namespaces every id; this is the check that it kept doing so.
    const idTrouble = await page.evaluate(() => {
      const seen = new Set<string>();
      const duplicated: string[] = [];
      for (const el of document.querySelectorAll("[id]")) {
        if (seen.has(el.id)) duplicated.push(el.id);
        seen.add(el.id);
      }
      const dangling: string[] = [];
      for (const el of document.querySelectorAll("[href^='#'], [*|href^='#']")) {
        const ref = (el.getAttribute("href") ?? "").slice(1);
        if (ref && !document.getElementById(ref)) dangling.push(ref);
      }
      return { duplicated, dangling, uses: document.querySelectorAll("use").length };
    });
    expect(idTrouble.uses).toBeGreaterThan(0); // there are glyph refs to get wrong
    expect(idTrouble.duplicated).toEqual([]);
    expect(idTrouble.dangling).toEqual([]);
    await expect(blocks.first()).toContainText("плиток");
    // Every cell says something — its statement, or that it has none yet. An
    // unfinished game prints as unfinished rather than as short. (Which of the
    // two a cell shows is not asserted: a board fills up over time, and Extreme
    // has no blanks left.)
    const texts = await blocks.allInnerTexts();
    expect(texts.filter((t) => t.trim().length > 10)).toHaveLength(9);
    // On paper: no site chrome, no buttons, and black on white however the
    // reader has the site themed.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.getByRole("button", { name: /Печать/ })).toBeHidden();
    await expect(page.locator(".abacus-print-problem").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = getComputedStyle(document.body);
          return {
            bg: s.backgroundColor,
            fg: s.color,
            theme: document.documentElement.dataset.theme,
          };
        }),
      )
      .toEqual({ bg: "rgb(255, 255, 255)", fg: "rgb(0, 0, 0)", theme: "dark" });

    // No statement is authored yet, so there is no .statement on the page to
    // measure — but that class is a dark panel on screen, and the printed sheet
    // must strip it, or every statement lands on paper as a black box. Put one in
    // and ask the stylesheet directly.
    const statement = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "statement";
      document.querySelector(".abacus-print")?.append(el);
      const s = getComputedStyle(el);
      const out = { bg: s.backgroundColor, color: s.color };
      el.remove();
      return out;
    });
    expect(statement).toEqual({ bg: "rgba(0, 0, 0, 0)", color: "rgb(0, 0, 0)" });

    // Each theme is handed out as its own sheet, except the first, which shares
    // the page with the title rather than leaving it blank.
    const breaks = await page.evaluate(() =>
      [...document.querySelectorAll(".abacus-print-theme")].map(
        (el) => getComputedStyle(el).breakBefore,
      ),
    );
    expect(breaks).toEqual(["auto", "page", "page"]);

    // The TikZ drawing follows: currentColor means it prints black even though
    // this reader is in dark mode.
    await expect
      .poll(() =>
        page
          .locator("svg.tikz-figure path")
          .first()
          .evaluate((el) => getComputedStyle(el).stroke),
      )
      .toBe("rgb(0, 0, 0)");
    await page.emulateMedia({ media: "screen" });

    await page.goto("/brainteasers/abacus/print?lang=both");
    await expect(
      page.getByRole("heading", { name: "Математическая абака / Math Abacus · Hard" }),
    ).toBeVisible();
    await expect(page.locator(".abacus-print-problem")).toHaveCount(9);
    await expect(page.locator(".abacus-print-lang")).toHaveCount(18);
  } finally {
    await editor.dispose();
  }
});

test("abacus: a draft is the editor's alone, and Publish puts it on the site", async ({
  page,
  context,
  browser,
}) => {
  // The only test that writes: it records the real state and restores it.
  const state = await teaserState("abacus");
  const editor = await asEditor(context);
  const anonCtx = await browser.newContext();
  page.on("dialog", (d) => d.accept()); // the confirm() on Unpublish

  try {
    await state.setPublished(false);

    // --- hidden -----------------------------------------------------------
    expect((await anonCtx.request.get("/brainteasers/abacus")).status()).toBe(404);
    expect((await anonCtx.request.get("/brainteasers/abacus/print")).status()).toBe(404);
    const anonPage = await anonCtx.newPage();
    await anonPage.goto("/brainteasers");
    await expect(anonPage.getByRole("link", { name: "Math Abacus" })).toHaveCount(0);
    // Publishing is not something a signed-out visitor can ask for either.
    const refused = await anonCtx.request.post("/api/brainteasers/abacus/publish", {
      data: { published: true },
    });
    expect(refused.status()).toBe(403);
    expect(await state.published()).toBe(false);

    // --- the editor's own view --------------------------------------------
    await page.goto("/brainteasers");
    const card = page.locator("li").filter({ has: page.getByRole("link", { name: "Math Abacus" }) });
    await expect(card.locator("span.badge").filter({ hasText: /^draft$/ })).toBeVisible();

    await page.goto("/brainteasers/abacus");
    await expect(page.getByTestId("abacus-draft-note")).toBeVisible();

    // --- publish ----------------------------------------------------------
    await page.getByTestId("teaser-publish-toggle").click();
    await expect(page.getByTestId("teaser-publish-toggle")).toHaveText("Unpublish");
    await expect(page.getByTestId("abacus-draft-note")).toHaveCount(0);
    expect(await state.published()).toBe(true);

    expect((await anonCtx.request.get("/brainteasers/abacus")).status()).toBe(200);
    await anonPage.goto("/brainteasers");
    await expect(anonPage.getByRole("link", { name: "Math Abacus" })).toBeVisible();

    // --- and back off the site --------------------------------------------
    await page.getByTestId("teaser-publish-toggle").click();
    await expect(page.getByTestId("abacus-draft-note")).toBeVisible();
    expect((await anonCtx.request.get("/brainteasers/abacus")).status()).toBe(404);
  } finally {
    await anonCtx.close();
    await editor.dispose();
    await state.dispose();
  }
});
