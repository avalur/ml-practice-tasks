import { NextResponse } from "next/server";

import { readBoard, sessionByCode } from "@/lib/abacus-session";

/* GET — the whole board behind a code: teams, levels, scores, verdicts.
 *
 * Public on purpose. The monitor is meant to hang on a projector and to be
 * openable by anyone in the room who knows the code, and nothing here is more
 * private than a team name. It is polled every few seconds by three different
 * screens, and the payload is a few hundred bytes, so it is sent whole rather
 * than through a `since` cursor.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await sessionByCode(code);
  if (!session) return NextResponse.json({ error: "no such session" }, { status: 404 });

  const board = await readBoard(session.id, session.code, session.title, session.closedAt);
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
