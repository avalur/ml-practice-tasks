import { NextResponse } from "next/server";

import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import { prisma } from "@/lib/db";
import { findDebateSpec, readLessonDebates } from "@/lib/debates";
import { crossSite, jsonBody } from "@/lib/http";
import { isMissingTable } from "@/lib/notebook-submissions";

type Params = { slug: string; lesson: string; debateId: string };

const ACTIONS = new Set(["open", "close", "reset"]);

/** POST { action: "open" | "close" | "reset" } — teacher controls for a debate poll. */
export async function POST(req: Request, { params }: { params: Promise<Params> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const { slug, lesson: lessonSlug, debateId } = await params;
  const [cls, access] = await Promise.all([getClassMeta(slug), getAccess(slug)]);
  const lesson = cls && findLesson(cls, lessonSlug);
  const spec = findDebateSpec(lesson, debateId);
  if (!cls || !lesson || !spec || !access.classRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!access.isTeacher) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const classId = access.classRow.id;
  const now = new Date();

  try {
    if (action === "open") {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.debatePoll.findUnique({
          where: { classId_lessonSlug_debateId: { classId, lessonSlug, debateId } },
          select: { id: true, openedAt: true },
        });
        if (existing) {
          await tx.debatePoll.update({
            where: { id: existing.id },
            data: {
              isOpen: true,
              openedAt: existing.openedAt ?? now,
              closedAt: null,
            },
          });
        } else {
          await tx.debatePoll.create({
            data: {
              classId,
              lessonSlug,
              debateId,
              isOpen: true,
              openedAt: now,
              closedAt: null,
            },
          });
        }
      });
    } else if (action === "close") {
      await prisma.debatePoll.upsert({
        where: { classId_lessonSlug_debateId: { classId, lessonSlug, debateId } },
        create: {
          classId,
          lessonSlug,
          debateId,
          isOpen: false,
          openedAt: now,
          closedAt: now,
        },
        update: {
          isOpen: false,
          closedAt: now,
        },
      });
    } else if (action === "reset") {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.debatePoll.findUnique({
          where: { classId_lessonSlug_debateId: { classId, lessonSlug, debateId } },
          select: { id: true },
        });
        if (!existing) return;
        await tx.debateVote.deleteMany({ where: { pollId: existing.id } });
        await tx.debatePoll.update({
          where: { id: existing.id },
          data: {
            isOpen: false,
            openedAt: null,
            closedAt: null,
          },
        });
      });
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
    userId: access.userId,
    isTeacher: access.isTeacher,
  });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
