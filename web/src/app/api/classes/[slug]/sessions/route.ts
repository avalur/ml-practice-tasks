import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deckHashFor, findLesson, getAccess, getClassMeta } from "@/lib/classes";

// POST { lessonSlug } — start (or resume) a lesson session. Teacher only.
//
// Resuming matters: reloading the present page mid-lecture must not orphan the
// ink already saved, so an un-ended session for the same lesson is handed back
// instead of a fresh one.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug : "";

  const meta = await getClassMeta(slug);
  if (!meta || !findLesson(meta, lessonSlug)) {
    return NextResponse.json({ error: "no such lesson" }, { status: 404 });
  }

  const open = await prisma.lessonSession.findFirst({
    where: { classId: access.classRow.id, lessonSlug, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  if (open) return NextResponse.json({ id: open.id, resumed: true });

  const created = await prisma.lessonSession.create({
    data: {
      classId: access.classRow.id,
      lessonSlug,
      deckHash: await deckHashFor(slug, lessonSlug),
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id, resumed: false });
}
