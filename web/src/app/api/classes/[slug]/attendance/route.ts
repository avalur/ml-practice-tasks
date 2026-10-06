import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { getAccess } from "@/lib/classes";

/** POST { lessonSlug, userId?, userIds?, attended } — mark lesson attendance.
 *
 * Teacher only. Can toggle a single student or batch update multiple students.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const lessonSlug = String(body.lessonSlug ?? "").trim();
  if (!lessonSlug) return NextResponse.json({ error: "missing lessonSlug" }, { status: 400 });

  const attended = Boolean(body.attended);
  const classId = access.classRow.id;

  if (Array.isArray(body.userIds)) {
    const userIds = body.userIds.map((id) => String(id)).filter(Boolean);
    await prisma.$transaction(
      userIds.map((userId) =>
        prisma.lessonAttendance.upsert({
          where: {
            classId_lessonSlug_userId: {
              classId,
              lessonSlug,
              userId,
            },
          },
          create: {
            classId,
            lessonSlug,
            userId,
            attended,
          },
          update: {
            attended,
          },
        }),
      ),
    );
    return NextResponse.json({ ok: true, count: userIds.length, attended });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "missing userId" }, { status: 400 });

  const record = await prisma.lessonAttendance.upsert({
    where: {
      classId_lessonSlug_userId: {
        classId,
        lessonSlug,
        userId,
      },
    },
    create: {
      classId,
      lessonSlug,
      userId,
      attended,
    },
    update: {
      attended,
    },
  });

  return NextResponse.json({ ok: true, attended: record.attended });
}

/** GET — return all attendance records for this class. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const attendances = await prisma.lessonAttendance.findMany({
    where: { classId: access.classRow.id, attended: true },
    select: { lessonSlug: true, userId: true },
  });

  return NextResponse.json({ ok: true, attendances });
}
