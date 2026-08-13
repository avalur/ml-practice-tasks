import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { crossSite, jsonBody } from "@/lib/http";
import { isSiteAdmin } from "@/lib/admin";
import { normalizeCode } from "@/lib/classes";
import { generateCode } from "@/lib/abacus-session";

const MAX_CODE = 24;
const MAX_TITLE = 60;

/* POST { code?, title? } — open an event. Site editors only.
 *
 * The code may be typed (it gets dictated to a room, so "ABAKA-7" beats a random
 * string) or left out, in which case one is generated from an alphabet with no
 * O/0 or I/1 in it. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isSiteAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const typed = String(body.code ?? "").trim().toUpperCase();
  const code = typed || generateCode();
  const title = String(body.title ?? "").trim() || null;

  if (code.length > MAX_CODE || !/^[A-Z0-9][A-Z0-9-]*$/.test(code)) {
    return NextResponse.json({ error: "codes may use A–Z, digits and dashes" }, { status: 400 });
  }
  if (title && title.length > MAX_TITLE) {
    return NextResponse.json({ error: "title is too long" }, { status: 400 });
  }
  const codeKey = normalizeCode(code);
  if (codeKey.length < 4) {
    return NextResponse.json({ error: "code is too short" }, { status: 400 });
  }
  if (await prisma.abacusSession.findUnique({ where: { codeKey } })) {
    return NextResponse.json({ error: "that code is already in use" }, { status: 409 });
  }

  const session = await auth();
  const row = await prisma.abacusSession.create({
    data: { code, codeKey, title, createdBy: session?.user?.email ?? "unknown" },
    select: { code: true, title: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, ...row });
}
