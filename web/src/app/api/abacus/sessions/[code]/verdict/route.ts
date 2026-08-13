import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { isSiteAdmin } from "@/lib/admin";
import { isLevel, markable } from "@/lib/abacus";
import { cellPoints, readBoard, sessionByCode, themesOf } from "@/lib/abacus-session";

/* POST { teamId, themeId, index, correct } — the jury rules on one cell.
 * POST { teamId, themeId, index, clear: true } — take the last verdict back.
 *
 * The ordering rule is enforced here rather than only in the grid: a verdict
 * goes on the cheapest un-ruled cell of its theme, and only the dearest ruled
 * one can be undone. Otherwise a mis-click could leave standings that say a team
 * handed in the 30 without ever handing in the 10 — which is not a state the
 * game has.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isSiteAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { code } = await params;
  const session = await sessionByCode(code);
  if (!session) return NextResponse.json({ error: "no such session" }, { status: 404 });
  if (session.closedAt) return NextResponse.json({ error: "session is closed" }, { status: 409 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const teamId = String(body.teamId ?? "");
  const themeId = String(body.themeId ?? "");
  const index = Number(body.index);
  const clear = body.clear === true;
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "bad cell" }, { status: 400 });
  }
  if (!clear && typeof body.correct !== "boolean") {
    return NextResponse.json({ error: "correct must be true or false" }, { status: 400 });
  }

  const team = await prisma.abacusTeam.findFirst({
    where: { id: teamId, sessionId: session.id },
    select: { id: true, level: true },
  });
  if (!team) return NextResponse.json({ error: "no such team" }, { status: 404 });

  const level = isLevel(team.level) ? team.level : "hard";
  const theme = themesOf(level).find((t) => t.id === themeId);
  if (!theme || index >= theme.points.length) {
    return NextResponse.json({ error: "no such cell on this board" }, { status: 400 });
  }

  const points = cellPoints(level, themeId, index);
  if (points === null) return NextResponse.json({ error: "no such cell" }, { status: 400 });

  /* Read the theme's verdicts and write inside one transaction: two laptops can
   * be judging the same room, and checking the order against a snapshot taken
   * before somebody else's insert is how a theme would end up with a hole in
   * it. */
  const outcome = await prisma.$transaction(async (tx) => {
    const live = await tx.abacusVerdict.findMany({
      where: { teamId: team.id, themeId },
      select: { themeId: true, index: true, correct: true, points: true },
    });
    const { next, undo } = markable(live, themeId, theme.points.length);
    if (clear) {
      if (undo !== index) return "undo-out-of-order" as const;
      await tx.abacusVerdict.deleteMany({ where: { teamId: team.id, themeId, index } });
      return "ok" as const;
    }
    if (next !== index) return "out-of-order" as const;
    await tx.abacusVerdict.create({
      data: { teamId: team.id, themeId, index, correct: body.correct === true, points },
    });
    return "ok" as const;
  });

  if (outcome === "undo-out-of-order") {
    return NextResponse.json(
      { error: "only the last verdict of a theme can be taken back" },
      { status: 400 },
    );
  }
  if (outcome === "out-of-order") {
    return NextResponse.json(
      { error: "problems are handed in in order — rule on the cheapest one left" },
      { status: 400 },
    );
  }

  const board = await readBoard(session.id, session.code, session.title, session.closedAt);
  return NextResponse.json({ ok: true, board });
}
