import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";

/* GET — hand a class member the annotated lecture PDF.
 *
 * The Blob store is **private**: the object URL recorded on the session answers
 * 403 to anyone, including us. So this route is the download link. It checks
 * membership, then mints a short-lived signed URL for that one object and
 * redirects to it, which keeps the file off the public internet and keeps the
 * bytes out of this function (a serverless response is capped well below the
 * size of a lecture PDF).
 */

const LINK_TTL_MS = 10 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; lesson: string }> },
) {
  const { slug, lesson } = await params;

  // 404 rather than 403 for outsiders: this should not confirm that a class,
  // a lesson or a recording exists.
  const access = await getAccess(slug);
  if (!access.classRow || !access.isMember) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const session = await prisma.lessonSession.findFirst({
    where: { classId: access.classRow.id, lessonSlug: lesson, pdfUrl: { not: null } },
    orderBy: { endedAt: "desc" },
    select: { pdfUrl: true },
  });
  if (!session?.pdfUrl) {
    return NextResponse.json({ error: "no notes published for this lesson" }, { status: 404 });
  }

  const pathname = decodeURIComponent(new URL(session.pdfUrl).pathname).replace(/^\//, "");
  try {
    const validUntil = Date.now() + LINK_TTL_MS;
    const signed = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(signed, {
      operation: "get",
      pathname,
      access: "private",
    });
    // `download=1` is not part of the signed payload, so appending it is safe —
    // and it is what makes the browser save the file instead of opening it.
    return NextResponse.redirect(`${presignedUrl}&download=1`, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not sign the download link";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
