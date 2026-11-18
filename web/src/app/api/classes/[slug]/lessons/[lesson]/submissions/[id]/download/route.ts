import { NextResponse } from "next/server";
import { readableSubmission, signedSubmissionUrl } from "@/lib/submission-access";

type RouteParams = {
  params: Promise<{ slug: string; lesson: string; id: string }>;
};

/* GET — signs a short-lived download link for a student's submitted file.
 *
 * Security:
 * - Blob store is private: object URL cannot be fetched directly without authorization.
 * - Authorized only for the submitting student author and course instructors.
 * - Returns 404 for outsiders to avoid leaking submission existence.
 * - Mints a short-lived (10-minute) presigned URL and 307 redirects with `&download=1`.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug, lesson, id } = await params;

  const submission = await readableSubmission(slug, lesson, id);
  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
  }

  try {
    const presignedUrl = await signedSubmissionUrl(submission.fileUrl);
    return NextResponse.redirect(`${presignedUrl}&download=1`, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[submission-download] could not sign a download link for", submission.fileUrl, err);
    return NextResponse.json(
      { error: "The submission file is temporarily unavailable." },
      { status: 503 },
    );
  }
}
