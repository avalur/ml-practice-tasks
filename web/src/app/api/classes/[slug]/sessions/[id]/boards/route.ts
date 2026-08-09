import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";

const BOARD_ID = /^b\d+$/;
const ANCHOR_ID = /^[sb]\d+$/;
const MAX_BOARDS = 500;

// PUT { boards: [{id, afterId}] } — the blank boards inserted during a lesson,
// in insertion order.
//
// Boards are real reveal sections injected into the deck at runtime, so the deck
// file on disk stays untouched and this list is the only record of where they
// went. `afterId` is the stable data-mlp-id of the page a board follows (null if
// its anchor was deleted, in which case the board is restored at the end).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!Array.isArray(body.boards) || body.boards.length > MAX_BOARDS) {
    return NextResponse.json({ error: "bad boards" }, { status: 400 });
  }

  const seen = new Set<string>();
  const boards: { id: string; afterId: string | null }[] = [];
  for (const raw of body.boards) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "bad board entry" }, { status: 400 });
    }
    const entry = raw as Record<string, unknown>;
    const boardId = typeof entry.id === "string" ? entry.id : "";
    if (!BOARD_ID.test(boardId) || seen.has(boardId)) {
      return NextResponse.json({ error: `bad board id ${boardId}` }, { status: 400 });
    }
    seen.add(boardId);
    const afterId = typeof entry.afterId === "string" ? entry.afterId : null;
    if (afterId !== null && !ANCHOR_ID.test(afterId)) {
      return NextResponse.json({ error: `bad afterId ${afterId}` }, { status: 400 });
    }
    boards.push({ id: boardId, afterId });
  }

  const updated = await prisma.lessonSession.updateMany({
    where: { id, classId: access.classRow.id },
    data: { boards },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "no such session" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, count: boards.length });
}
