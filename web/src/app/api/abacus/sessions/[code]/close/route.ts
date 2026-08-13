import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { isSiteAdmin } from "@/lib/admin";
import { sessionByCode } from "@/lib/abacus-session";

/* POST { closed: boolean } — end the event, or re-open it.
 *
 * Closing stops joins and marking; the monitor keeps showing the final
 * standings, which is what stays on the projector while prizes are handed out.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isSiteAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { code } = await params;
  const session = await sessionByCode(code);
  if (!session) return NextResponse.json({ error: "no such session" }, { status: 404 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  if (typeof body.closed !== "boolean") {
    return NextResponse.json({ error: "closed must be true or false" }, { status: 400 });
  }

  const row = await prisma.abacusSession.update({
    where: { id: session.id },
    data: { closedAt: body.closed ? new Date() : null },
    select: { closedAt: true },
  });
  return NextResponse.json({ ok: true, closedAt: row.closedAt });
}
