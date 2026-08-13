import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { isSiteAdmin } from "@/lib/admin";
import { sessionByCode } from "@/lib/abacus-session";

/* DELETE — drop a team. Site editors only.
 *
 * The escape hatch for the two things that go wrong at a live event: a duplicate
 * registration, and a team that lost its cookie and needs to join again under
 * the same name. Their verdicts go with them, which is why it asks first in the
 * UI.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isSiteAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { code, id } = await params;
  const session = await sessionByCode(code);
  if (!session) return NextResponse.json({ error: "no such session" }, { status: 404 });

  const { count } = await prisma.abacusTeam.deleteMany({
    where: { id, sessionId: session.id },
  });
  if (count === 0) return NextResponse.json({ error: "no such team" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
