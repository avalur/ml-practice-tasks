import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";
import {
  getBlobPathname,
  isAuthorizedToDownload,
  SUBMISSION_LINK_TTL_MS,
} from "@/lib/submissions";

type RouteParams = {
  params: Promise<{ slug: string; lesson: string; id: string }>;
};

/* GET — signs a short-lived download link for a student's submitted .ipynb notebook.
 *
 * Security:
 * - Blob store is private: object URL cannot be fetched directly without authorization.
 * - Authorized only for the submitting student author and course instructors.
 * - Returns 404 for outsiders to avoid leaking submission existence.
 * - Mints a short-lived (10-minute) presigned URL and 307 redirects with `&download=1`.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug, lesson, id } = await params;

  const access = await getAccess(slug);
  if (!access.classRow || !access.visible || !access.isMember) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const submission = await prisma.notebookSubmission.findFirst({
    where: {
      id,
      classId: access.classRow.id,
      lessonSlug: lesson,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!isAuthorizedToDownload(submission.userId, access.userId, access.isTeacher)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
  }

  const pathname = getBlobPathname(submission.fileUrl);
  try {
    const validUntil = Date.now() + SUBMISSION_LINK_TTL_MS;
    const signed = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(signed, {
      operation: "get",
      pathname,
      access: "private",
    });

    return NextResponse.redirect(`${presignedUrl}&download=1`, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[submission-download] could not sign a download link for", pathname, err);
    return NextResponse.json(
      { error: "The submission file is temporarily unavailable." },
      { status: 503 },
    );
  }
}
