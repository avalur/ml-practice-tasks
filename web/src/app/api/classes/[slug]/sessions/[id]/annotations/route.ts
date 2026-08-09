import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";

type Params = { slug: string; id: string };

// Ink is keyed by the stable data-mlp-id stamped on each page: "s<n>" for a
// slide of the deck, "b<n>" for a blank board inserted during the lesson.
const PAGE_KEY = /^[sb]\d+$/;

/** Teacher of `slug` who owns session `id`, or an error response. */
async function requireOwner(slug: string, id: string) {
  const access = await getAccess(slug);
  if (!access.classRow) {
    return { error: NextResponse.json({ error: "no such class" }, { status: 404 }) };
  }
  if (!access.isTeacher) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const session = await prisma.lessonSession.findFirst({
    where: { id, classId: access.classRow.id },
    select: { id: true, deckHash: true, lessonSlug: true, boards: true },
  });
  if (!session) {
    return { error: NextResponse.json({ error: "no such session" }, { status: 404 }) };
  }
  return { session };
}

// GET — every saved page of ink plus the board list, so a reload (or a crash)
// resumes the lecture with the boards back in place.
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { slug, id } = await params;
  const { error, session } = await requireOwner(slug, id);
  if (error) return error;

  const rows = await prisma.lessonAnnotation.findMany({
    where: { sessionId: session!.id },
    select: { pageKey: true, strokes: true },
  });
  return NextResponse.json({
    deckHash: session!.deckHash,
    boards: session!.boards ?? [],
    pages: rows,
  });
}

// PUT { pageKey, strokes } — upsert one page. Called on a 1.5 s debounce while
// drawing, so it stays small and idempotent. An empty stroke list deletes the
// row rather than storing "[]" forever.
export async function PUT(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  const { slug, id } = await params;
  const { error, session } = await requireOwner(slug, id);
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const pageKey = typeof body.pageKey === "string" ? body.pageKey : "";
  if (!PAGE_KEY.test(pageKey)) {
    return NextResponse.json({ error: "bad pageKey" }, { status: 400 });
  }
  if (!Array.isArray(body.strokes)) {
    return NextResponse.json({ error: "bad strokes" }, { status: 400 });
  }
  const strokes = body.strokes;
  if (JSON.stringify(strokes).length > 2_000_000) {
    return NextResponse.json({ error: "page too large" }, { status: 413 });
  }

  if (strokes.length === 0) {
    await prisma.lessonAnnotation.deleteMany({
      where: { sessionId: session!.id, pageKey },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  await prisma.lessonAnnotation.upsert({
    where: { sessionId_pageKey: { sessionId: session!.id, pageKey } },
    create: { sessionId: session!.id, pageKey, strokes },
    update: { strokes },
  });
  return NextResponse.json({ ok: true });
}

// DELETE ?pageKey=b3 — drop one page's ink, used when a board is deleted.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  const { slug, id } = await params;
  const { error, session } = await requireOwner(slug, id);
  if (error) return error;

  const pageKey = new URL(req.url).searchParams.get("pageKey") ?? "";
  if (!PAGE_KEY.test(pageKey)) {
    return NextResponse.json({ error: "bad pageKey" }, { status: 400 });
  }
  await prisma.lessonAnnotation.deleteMany({
    where: { sessionId: session!.id, pageKey },
  });
  return NextResponse.json({ ok: true });
}
