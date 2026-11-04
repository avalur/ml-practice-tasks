import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { sanitizeDeck } from "@/lib/deck-sanitize";
import { STUDIO_LIMITS, editableClass, validateLessonItems } from "@/lib/studio";

type Ctx = { params: Promise<{ slug: string; lesson: string }> };

/* PATCH { title?, date?, deck?, practice?, homework? } — save part of a lesson.
 *
 * The deck is sanitized here, and the sanitized text is what is stored and what
 * comes back, together with `stripped: true` when that changed anything — the
 * editor then shows the teacher what the site will actually render rather than
 * silently dropping their <script>. Items are validated against the catalogue
 * and stored unexpanded, so a `py_*` homework picks up tasks added later. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug, lesson } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const row = await prisma.studioLesson.findUnique({
    where: { classId_slug: { classId: g.cls.id, slug: lesson } },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "no such lesson" }, { status: 404 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const data: Record<string, unknown> = {};
  let stripped = false;
  let deck: string | undefined;

  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (!t || t.length > STUDIO_LIMITS.title) return NextResponse.json({ error: "bad title" }, { status: 400 });
    data.title = t;
  }
  if (body.date !== undefined) {
    const d = typeof body.date === "string" ? body.date.trim() : "";
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    data.date = d || null;
  }
  if (body.deck !== undefined) {
    if (typeof body.deck !== "string") return NextResponse.json({ error: "deck must be text" }, { status: 400 });
    deck = sanitizeDeck(body.deck);
    if (Buffer.byteLength(deck) > STUDIO_LIMITS.deckBytes) {
      return NextResponse.json(
        { error: `The slides are too large (${Math.round(Buffer.byteLength(deck) / 1000)} kB; limit ${STUDIO_LIMITS.deckBytes / 1000} kB). Inline images count — upload them instead.` },
        { status: 413 },
      );
    }
    stripped = deck.replace(/\s+/g, "") !== body.deck.replace(/\s+/g, "");
    data.deck = deck;
  }
  if (body.practice !== undefined || body.homework !== undefined) {
    const current = await prisma.studioLesson.findUniqueOrThrow({
      where: { id: row.id },
      select: { practice: true, homework: true },
    });
    const v = await validateLessonItems(
      body.practice !== undefined ? body.practice : current.practice,
      body.homework !== undefined ? body.homework : current.homework,
    );
    if (v.errors.length) return NextResponse.json({ error: v.errors.join("\n"), errors: v.errors }, { status: 400 });
    data.practice = v.practice;
    // Prisma needs DbNull rather than null to clear a Json? column.
    data.homework = v.homework ?? Prisma.DbNull;
  }

  await prisma.studioLesson.update({ where: { id: row.id }, data });
  return NextResponse.json({ ok: true, deck, stripped });
}

/* DELETE — remove a lesson, unless notebooks were already handed in for it:
 * those submissions are keyed by the lesson slug and would be orphaned. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug, lesson } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const handedIn = await prisma.notebookSubmission
    .count({ where: { classId: g.cls.id, lessonSlug: lesson } })
    .catch(() => 0);
  if (handedIn > 0) {
    return NextResponse.json({ error: "Students have handed in work for this lesson." }, { status: 409 });
  }
  const { count } = await prisma.studioLesson.deleteMany({ where: { classId: g.cls.id, slug: lesson } });
  if (count === 0) return NextResponse.json({ error: "no such lesson" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
