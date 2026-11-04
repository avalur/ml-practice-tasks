import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { STUDIO_LIMITS, editableClass, newLessonSlug, starterDeck } from "@/lib/studio";

type Ctx = { params: Promise<{ slug: string }> };

/* PATCH { title?, description? } — rename or re-describe the course. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const data: { title?: string; description?: string | null } = {};
  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (!t || t.length > STUDIO_LIMITS.title) return NextResponse.json({ error: "bad title" }, { status: 400 });
    data.title = t;
  }
  if (body.description !== undefined) {
    const d = typeof body.description === "string" ? body.description.trim() : "";
    if (d.length > STUDIO_LIMITS.description) return NextResponse.json({ error: "too long" }, { status: 400 });
    data.description = d || null;
  }
  await prisma.class.update({ where: { id: g.cls.id }, data });
  return NextResponse.json({ ok: true });
}

/* POST { title } — add a lesson at the end, with a starter deck. */
export async function POST(req: Request, { params }: Ctx) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > STUDIO_LIMITS.title) {
    return NextResponse.json({ error: "Give the lesson a title." }, { status: 400 });
  }

  const lessons = await prisma.studioLesson.findMany({
    where: { classId: g.cls.id },
    select: { slug: true, position: true },
  });
  if (lessons.length >= STUDIO_LIMITS.lessons) {
    return NextResponse.json({ error: `At most ${STUDIO_LIMITS.lessons} lessons per course.` }, { status: 409 });
  }
  const position = lessons.reduce((m, l) => Math.max(m, l.position + 1), 0);
  // The slug is permanent — ink, sessions and submissions are keyed by it — so
  // it is made once from the first title and never follows a rename.
  let lessonSlug = newLessonSlug(position, title);
  const taken = new Set(lessons.map((l) => l.slug));
  for (let n = 2; taken.has(lessonSlug); n++) lessonSlug = `${newLessonSlug(position, title)}-${n}`;

  await prisma.studioLesson.create({
    data: {
      classId: g.cls.id,
      slug: lessonSlug,
      title,
      position,
      deck: starterDeck(title),
    },
  });
  return NextResponse.json({ ok: true, lesson: lessonSlug });
}

/* DELETE — remove the course. Only a course nobody has joined: once students
 * have a group code in it, deleting would take their homework with it. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const { count } = await prisma.class.deleteMany({
    where: { id: g.cls.id, enrollments: { none: { inviteId: { not: null } } } },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: "Students have joined this course — unpublish it instead of deleting it." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
