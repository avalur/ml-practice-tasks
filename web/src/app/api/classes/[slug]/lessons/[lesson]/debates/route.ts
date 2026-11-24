import { NextResponse } from "next/server";

import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import { readLessonDebates } from "@/lib/debates";

type Params = { slug: string; lesson: string };

/** GET — live poll state and tallies for every debate on a lesson.
 *
 * Follows the lesson's own visibility gate (published class, or teacher/admin).
 * Aggregate counts are returned to anyone who can view the lesson so the
 * results can sit on a projector; individual voter names are included strictly
 * for teachers of the class.
 */
export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { slug, lesson: lessonSlug } = await params;
  const [cls, access] = await Promise.all([getClassMeta(slug), getAccess(slug)]);
  const lesson = cls && findLesson(cls, lessonSlug);
  if (!cls || !lesson || !access.classRow || !access.visible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const debates = lesson.debates ?? [];
  if (debates.length === 0) {
    return NextResponse.json({ error: "no debates on this lesson" }, { status: 404 });
  }

  const data = await readLessonDebates({
    classId: access.classRow.id,
    lessonSlug,
    debates,
    userId: access.userId,
    isTeacher: access.isTeacher,
  });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
