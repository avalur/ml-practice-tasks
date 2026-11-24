import { NextResponse } from "next/server";

import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import { prisma } from "@/lib/db";
import { findDebateSpec, readLessonDebates } from "@/lib/debates";
import { crossSite, jsonBody } from "@/lib/http";
import { isMissingTable } from "@/lib/notebook-submissions";

type Params = { slug: string; lesson: string; debateId: string };

/** POST { teamId } — cast or switch a member's vote in an open debate poll.
 *
 * Restricted to class members (enrolled students with a group code, plus the
 * class's teachers). Each member holds at most one vote per debate and may
 * change teams while the poll stays open.
 */
export async function POST(req: Request, { params }: { params: Promise<Params> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const { slug, lesson: lessonSlug, debateId } = await params;
  const [cls, access] = await Promise.all([getClassMeta(slug), getAccess(slug)]);
  const lesson = cls && findLesson(cls, lessonSlug);
  const spec = findDebateSpec(lesson, debateId);
  if (!cls || !lesson || !spec || !access.classRow || !access.visible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!access.userId) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }
  if (!access.isMember) {
    return NextResponse.json(
      { error: "Join this class with a group code to vote." },
      { status: 403 },
    );
  }

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!teamId || !spec.teams.some((t) => t.id === teamId)) {
    return NextResponse.json({ error: "unknown team" }, { status: 400 });
  }

  const classId = access.classRow.id;
  const userId = access.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const poll = await tx.debatePoll.findUnique({
        where: { classId_lessonSlug_debateId: { classId, lessonSlug, debateId } },
        select: { id: true, isOpen: true },
      });
      if (!poll || !poll.isOpen) {
        return { open: false as const };
      }
      await tx.debateVote.upsert({
        where: { pollId_userId: { pollId: poll.id, userId } },
        create: { pollId: poll.id, userId, teamId },
        update: { teamId },
      });
      return { open: true as const };
    });

    if (!result.open) {
      return NextResponse.json({ error: "Voting is closed." }, { status: 409 });
    }
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "Debate voting is currently unavailable (database table not migrated yet)." },
        { status: 503 },
      );
    }
    throw err;
  }

  const data = await readLessonDebates({
    classId,
    lessonSlug,
    debates: lesson.debates ?? [],
    userId,
    isTeacher: access.isTeacher,
  });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
