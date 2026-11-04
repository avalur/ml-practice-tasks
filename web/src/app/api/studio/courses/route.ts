import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { crossSite, jsonBody } from "@/lib/http";
import { isPlatformTeacher } from "@/lib/teachers";
import { STUDIO_LIMITS, newCourseSlug, newLessonSlug, starterDeck } from "@/lib/studio";

/* POST { title, description? } — start a new studio course.
 *
 * It is born a draft (publishedAt null), owned by the caller, with the caller
 * as its only teacher and one lesson holding a starter deck — so the next page
 * the teacher sees already has slides to look at. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();
  if (!userId || !email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isPlatformTeacher())) {
    return NextResponse.json({ error: "teacher role required" }, { status: 403 });
  }

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!title) return NextResponse.json({ error: "Give the course a title." }, { status: 400 });
  if (title.length > STUDIO_LIMITS.title || description.length > STUDIO_LIMITS.description) {
    return NextResponse.json({ error: "too long" }, { status: 400 });
  }

  const owned = await prisma.class.count({ where: { ownerId: userId, source: "studio" } });
  if (owned >= STUDIO_LIMITS.courses) {
    return NextResponse.json(
      { error: `You already have ${STUDIO_LIMITS.courses} courses — the current limit.` },
      { status: 409 },
    );
  }

  // The random tail makes a collision vanishingly rare; retry once anyway
  // rather than answer 500 on a unique violation.
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = newCourseSlug(title);
    try {
      const cls = await prisma.class.create({
        data: {
          slug,
          title,
          description: description || null,
          source: "studio",
          ownerId: userId,
          teacherEmails: [email],
          publishedAt: null,
          studioLessons: {
            create: {
              slug: newLessonSlug(0, "intro"),
              title: "Lesson 1. Introduction",
              position: 0,
              deck: starterDeck(title),
            },
          },
        },
        select: { slug: true },
      });
      return NextResponse.json({ ok: true, slug: cls.slug });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt > 0) throw e;
    }
  }
  return NextResponse.json({ error: "could not create" }, { status: 500 });
}
