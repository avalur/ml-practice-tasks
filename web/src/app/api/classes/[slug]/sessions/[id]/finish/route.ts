import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";

// POST { bytes? } — close the lesson session.
//
// The lecture PDF is assembled in the browser and downloaded straight to the
// teacher's machine, who shares it with the class themselves. Nothing is
// uploaded, so this only records that the lesson ended and how large the file
// was — enough for the class page to show which lessons have been delivered.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let bytes: number | null = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const n = Number(body.bytes);
    if (Number.isFinite(n) && n > 0) bytes = Math.round(n);
  } catch {
    // A body is optional here; finishing without one is fine.
  }

  const updated = await prisma.lessonSession.updateMany({
    where: { id, classId: access.classRow.id },
    data: { endedAt: new Date(), pdfBytes: bytes },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "no such session" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
