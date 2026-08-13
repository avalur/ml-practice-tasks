import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { crossSite, jsonBody, rateLimited } from "@/lib/http";
import { isLevel } from "@/lib/abacus";
import {
  TEAM_COOKIE,
  newToken,
  sessionByCode,
  teamCookieOptions,
} from "@/lib/abacus-session";

const MAX_NAME = 40;

/* POST { code, name, level } — a team enters the event.
 *
 * No account: the reply sets an httpOnly cookie holding a fresh token, and that
 * cookie is the team from then on. Rate limited per address because this is the
 * one anonymous write on the site — though the limit is sized for a whole room
 * behind one NAT joining at once, which is exactly what happens at the start.
 */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (rateLimited(req, "abacus-join", 40, 60_000)) {
    return NextResponse.json({ error: "too many attempts, wait a moment" }, { status: 429 });
  }

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const level = body.level;
  if (!name) return NextResponse.json({ error: "name your team" }, { status: 400 });
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: "team name is too long" }, { status: 400 });
  }
  if (!isLevel(level)) {
    return NextResponse.json({ error: "pick a difficulty" }, { status: 400 });
  }

  const session = await sessionByCode(String(body.code ?? ""));
  // Same answer for a wrong code and a finished event: a stranger guessing codes
  // learns nothing either way.
  if (!session) return NextResponse.json({ error: "no game with that code" }, { status: 404 });
  if (session.closedAt) {
    return NextResponse.json({ error: "this game is already over" }, { status: 409 });
  }

  const taken = await prisma.abacusTeam.findFirst({
    where: { sessionId: session.id, name },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "a team here already has that name" }, { status: 409 });
  }

  const token = newToken();
  await prisma.abacusTeam.create({
    data: { sessionId: session.id, name, level, token },
  });

  const res = NextResponse.json({ ok: true, name, level, code: session.code });
  res.cookies.set(TEAM_COOKIE, token, teamCookieOptions(new URL(req.url).protocol === "https:"));
  return res;
}
