import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { getAccess } from "@/lib/classes";

/* POST { bytes?, url? } — close the lesson session, then publish its PDF.
 *
 * Present mode calls this twice: once the moment the PDF is built (with `bytes`,
 * which ends the lesson and hands the file to the teacher's downloads), and again
 * when the background upload to Vercel Blob finishes (with `url`). The upload can
 * fail or be skipped entirely — there may be no Blob store — so the two are
 * deliberately separate: a lesson counts as delivered without a published copy.
 */

/** Blob URLs only: `url` arrives from the browser, and it ends up as a link the
 * whole class clicks. */
function isBlobUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (u.hostname === "blob.vercel-storage.com" ||
        u.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug, id } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  /* An *empty* body is allowed — "the lesson is over, there is no PDF" is a
   * valid call. Malformed JSON is not: swallowing it would turn a bug in
   * present.html into a silently unpublished lecture. */
  let bytes: number | null = null;
  let url: string | null = null;
  const raw = (await req.text()).trim();
  if (raw) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "bad json" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "bad json" }, { status: 400 });
    }
    const fields = body as Record<string, unknown>;
    const n = Number(fields.bytes);
    if (Number.isFinite(n) && n > 0) bytes = Math.round(n);
    if (typeof fields.url === "string" && fields.url) {
      if (!isBlobUrl(fields.url)) {
        return NextResponse.json({ error: "url is not a Vercel Blob URL" }, { status: 400 });
      }
      url = fields.url;
    }
  }

  const existing = await prisma.lessonSession.findFirst({
    where: { id, classId: access.classRow.id },
    select: { id: true, endedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "no such session" }, { status: 404 });
  }

  await prisma.lessonSession.update({
    where: { id: existing.id },
    data: {
      // Keep the first end time: the second call lands minutes later, once the
      // upload is through, and that is not when the lesson ended.
      endedAt: existing.endedAt ?? new Date(),
      ...(bytes === null ? {} : { pdfBytes: bytes }),
      ...(url === null ? {} : { pdfUrl: url }),
    },
  });
  return NextResponse.json({ ok: true });
}
