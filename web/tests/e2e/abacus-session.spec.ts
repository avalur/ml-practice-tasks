import { test, expect, type BrowserContext } from "@playwright/test";

import { abacusSession, signInAs } from "./support/session";

/* A live abacus event: a code, teams with no accounts, a jury, a projector.
 *
 * The fixture makes its own scratch session (code `E2E-<pid>`) and deletes it
 * afterwards, so a real game can be running in the same database while this
 * suite does its worst. */
const ADMIN = { email: "e2e-admin@example.test", name: "E2E Admin" };

async function join(ctx: BrowserContext, code: string, name: string, level: string) {
  return ctx.request.post("/api/abacus/join", { data: { code, name, level } });
}

test("a team joins with a code, no account, and appears on the public monitor", async ({
  browser,
}) => {
  const game = await abacusSession();
  const teamCtx = await browser.newContext(); // signed out, deliberately
  const anonCtx = await browser.newContext();
  try {
    const page = await teamCtx.newPage();
    await page.goto(`/brainteasers/abacus/join?code=${game.code}`);
    await page.getByLabel("Team name", { exact: false }).fill("Пифагоры");
    await page.getByTestId("abx-level-hard").click();
    await page.getByTestId("abx-join").click();

    // Landed on their own board, named, at zero.
    await expect(page.getByRole("heading", { name: "Пифагоры" })).toBeVisible();
    await expect(page.getByTestId("abx-my-score")).toContainText("0");
    await expect(page.locator(".abacus-cell")).toHaveCount(9);

    // …and on the projector, which anybody with the code can open.
    const wall = await anonCtx.newPage();
    await wall.goto(`/brainteasers/abacus/m/${game.code}`);
    await expect(wall.getByTestId("abx-team-Пифагоры")).toBeVisible();
    await expect(wall.getByTestId("abx-code")).toHaveText(game.code);

    // The same name twice in one game is refused.
    const dup = await join(anonCtx, game.code, "Пифагоры", "hard");
    expect(dup.status()).toBe(409);
  } finally {
    await anonCtx.close();
    await teamCtx.close();
    await game.dispose();
  }
});

test("the jury's verdicts reach the team's screen and the projector", async ({
  page,
  context,
  browser,
}) => {
  const game = await abacusSession();
  const editor = await signInAs(context, ADMIN);
  const teamCtx = await browser.newContext();
  const anonCtx = await browser.newContext();
  try {
    await join(teamCtx, game.code, "Гауссы", "hard");

    await page.goto(`/brainteasers/abacus/s/${game.code}`);
    // Two cells in a row without waiting in between — how a jury actually works,
    // and what used to drop the second click on the floor.
    await page.getByTestId("abx-ok-Гауссы-geometry-0").click();
    await page.getByTestId("abx-bad-Гауссы-combinatorics-0").click();
    await page.getByTestId("abx-ok-Гауссы-geometry-1").click();

    // The database first, so a failure says whether the verdict was refused or
    // merely not drawn.
    await expect
      .poll(async () =>
        (await game.board()).teams[0].verdicts
          .map((v) => `${v.themeId}#${v.index}=${v.correct}`)
          .sort(),
      )
      .toEqual(["combinatorics#0=false", "geometry#0=true", "geometry#1=true"]);
    await expect(page.getByTestId("abx-mark-score-Гауссы")).toHaveText("30");

    // Still 30 after a poll or two: a stale board must not undo a fresh verdict.
    await page.waitForTimeout(7000);
    await expect(page.getByTestId("abx-mark-score-Гауссы")).toHaveText("30");

    const team = await teamCtx.newPage();
    await team.goto("/brainteasers/abacus/team");
    await expect(team.getByTestId("abx-my-score")).toContainText("30");
    await expect(team.getByTestId("abx-my-cell-geometry-0")).toHaveAttribute("data-state", "done");
    await expect(team.getByTestId("abx-my-cell-combinatorics-0")).toHaveAttribute(
      "data-state",
      "wrong",
    );
    // The team can switch to the shared view without leaving their page.
    await team.getByTestId("abx-view-all").click();
    await expect(team.getByTestId("abx-monitor")).toBeVisible();

    const wall = await anonCtx.newPage();
    await wall.goto(`/brainteasers/abacus/m/${game.code}`);
    await expect(wall.getByTestId("abx-score-Гауссы")).toContainText("30");
    await expect(wall.getByTestId("abx-cell-Гауссы-geometry-0")).toHaveAttribute(
      "data-state",
      "ok",
    );
    await expect(wall.getByTestId("abx-cell-Гауссы-combinatorics-0")).toHaveAttribute(
      "data-state",
      "bad",
    );
  } finally {
    await anonCtx.close();
    await teamCtx.close();
    await editor.dispose();
    await game.dispose();
  }
});

test("verdicts go in order, and only the last one can be taken back", async ({
  context,
  browser,
}) => {
  const game = await abacusSession();
  const editor = await signInAs(context, ADMIN);
  const teamCtx = await browser.newContext();
  try {
    await join(teamCtx, game.code, "Эйлеры", "extreme");
    const teamId = (await game.board()).teams[0].id;
    const verdict = (data: Record<string, unknown>) =>
      context.request.post(`/api/abacus/sessions/${game.code}/verdict`, { data });

    // The 30 cannot be ruled on before the 10 and the 20.
    const early = await verdict({ teamId, themeId: "geometry", index: 2, correct: true });
    expect(early.status()).toBe(400);

    expect((await verdict({ teamId, themeId: "geometry", index: 0, correct: true })).ok()).toBe(true);
    expect((await verdict({ teamId, themeId: "geometry", index: 1, correct: false })).ok()).toBe(
      true,
    );
    // Undo takes the 20 back, not the 10 underneath it.
    const wrongUndo = await verdict({ teamId, themeId: "geometry", index: 0, clear: true });
    expect(wrongUndo.status()).toBe(400);
    expect((await verdict({ teamId, themeId: "geometry", index: 1, clear: true })).ok()).toBe(true);

    const after = await game.board();
    expect(after.teams[0].verdicts.map((v) => v.index)).toEqual([0]);
  } finally {
    await teamCtx.close();
    await editor.dispose();
    await game.dispose();
  }
});

test("only an editor rules, and a closed game takes no more teams", async ({ browser }) => {
  const game = await abacusSession();
  const anonCtx = await browser.newContext();
  try {
    // The board is public — that is the point of the projector.
    expect((await anonCtx.request.get(`/api/abacus/sessions/${game.code}/board`)).ok()).toBe(true);
    expect((await anonCtx.request.get(`/brainteasers/abacus/m/${game.code}`)).status()).toBe(200);
    // The jury's page and its route are not.
    expect((await anonCtx.request.get(`/brainteasers/abacus/s/${game.code}`)).status()).toBe(404);
    const refused = await anonCtx.request.post(`/api/abacus/sessions/${game.code}/verdict`, {
      data: { teamId: "x", themeId: "geometry", index: 0, correct: true },
    });
    expect(refused.status()).toBe(403);
    expect(
      (await anonCtx.request.post("/api/abacus/sessions", { data: { title: "nope" } })).status(),
    ).toBe(403);

    await game.setClosed(true);
    const late = await join(anonCtx, game.code, "Опоздавшие", "hard");
    expect(late.status()).toBe(409);
    // A wrong code says the same thing whether or not it ever existed.
    expect((await join(anonCtx, "NO-SUCH-CODE", "X", "hard")).status()).toBe(404);
  } finally {
    await anonCtx.close();
    await game.dispose();
  }
});
