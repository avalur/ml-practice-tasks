import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BlobError } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import {
  ALLOWED_SUBMISSION_MIME_TYPES,
  findAssignmentInLesson,
  MAX_SUBMISSION_BYTES,
  SubmissionApiError,
  SUBMISSION_LINK_TTL_MS,
  submissionPrefix,
  validateSubmissionPath,
} from "@/lib/submissions";

/* Mints a short-lived client upload token for submitting a Jupyter Notebook (.ipynb).
 *
 * Scoped strictly to:
 * - Authenticated student enrolled in the specified class
 * - Exact class, lesson, student userId, and assignmentId path prefix
 * - Private blob storage with 10-minute expiry and immutable (no-overwrite) flag
 * - Enforces single submission: rejects token generation if submission already recorded.
 */
export async function POST(req: Request) {
  if (crossSite(req)) {
    return NextResponse.json({ error: "cross-site request refused" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: { classSlug?: string; lessonSlug?: string; assignmentId?: string };
        try {
          payload = JSON.parse(clientPayload ?? "{}");
        } catch {
          throw new SubmissionApiError(400, "clientPayload must be valid JSON");
        }

        if (!payload.classSlug || !payload.lessonSlug || !payload.assignmentId) {
          throw new SubmissionApiError(
            400,
            "clientPayload must carry classSlug, lessonSlug, and assignmentId",
          );
        }

        const access = await getAccess(payload.classSlug);
        if (!access.classRow || !access.visible) {
          throw new SubmissionApiError(404, "no such class");
        }
        if (!access.userId) {
          throw new SubmissionApiError(401, "unauthorized");
        }
        if (!access.isStudent) {
          throw new SubmissionApiError(
            403,
            access.isTeacher
              ? "forbidden: instructors cannot submit homework"
              : "forbidden: not enrolled in this class",
          );
        }

        const cls = await getClassMeta(payload.classSlug);
        if (!cls) {
          throw new SubmissionApiError(404, "no such class in manifest");
        }
        const lesson = findLesson(cls, payload.lessonSlug);
        if (!lesson) {
          throw new SubmissionApiError(404, "no such lesson in class");
        }
        const assignment = findAssignmentInLesson(lesson, payload.assignmentId);
        if (!assignment) {
          throw new SubmissionApiError(404, "no such assignment in this lesson");
        }

        const expectedPrefix = submissionPrefix(
          payload.classSlug,
          payload.lessonSlug,
          access.userId,
          payload.assignmentId,
        );
        const pathCheck = validateSubmissionPath(pathname, expectedPrefix);
        if (!pathCheck.valid) {
          throw new SubmissionApiError(403, pathCheck.error ?? "invalid submission path");
        }

        let existing = null;
        try {
          existing = await prisma.notebookSubmission.findUnique({
            where: {
              userId_classId_lessonSlug_assignmentId: {
                userId: access.userId,
                classId: access.classRow.id,
                lessonSlug: payload.lessonSlug,
                assignmentId: payload.assignmentId,
              },
            },
          });
        } catch (dbErr: unknown) {
          if (
            typeof dbErr === "object" &&
            dbErr !== null &&
            "code" in dbErr &&
            (dbErr as { code: string }).code === "P2021"
          ) {
            throw new SubmissionApiError(
              503,
              "notebook submissions are not enabled yet (database table missing)",
            );
          }
          throw dbErr;
        }
        if (existing) {
          throw new SubmissionApiError(409, "assignment already submitted");
        }

        return {
          allowedContentTypes: ALLOWED_SUBMISSION_MIME_TYPES,
          addRandomSuffix: true,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_SUBMISSION_BYTES,
          validUntil: Date.now() + SUBMISSION_LINK_TTL_MS,
        };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof SubmissionApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2021"
    ) {
      return NextResponse.json(
        { error: "notebook submissions are not enabled yet (database table missing)" },
        { status: 503 },
      );
    }
    if (err instanceof BlobError || (err instanceof Error && err.name === "BlobError")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("upload-submission-token internal error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
