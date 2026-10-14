import path from "node:path";
import { NextResponse } from "next/server";
import { del, head } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import {
  findAssignmentInLesson,
  getBlobPathname,
  getStoreIdFromToken,
  isBlobUrl,
  isSameSubmissionFile,
  MAX_SUBMISSION_BYTES,
  sanitizeFileName,
  submissionPrefix,
  validateSubmissionPath,
} from "@/lib/submissions";

type RouteParams = {
  params: Promise<{ slug: string; lesson: string }>;
};

/* POST — records student .ipynb notebook submission after client upload to Vercel Blob.
 *
 * Security & integrity:
 * - Cross-site and JSON body guards on cookie mutation
 * - Revalidates student enrollment and lesson assignment existence
 * - Strict pathname prefix validation prevents using other students' blobs or arbitrary paths
 * - Server-side blob verification (head) checks actual blob existence and byte size
 * - Handles concurrent submit races and DB unique conflict with orphan blob cleanup
 */
export async function POST(req: Request, { params }: RouteParams) {
  if (crossSite(req)) {
    return NextResponse.json({ error: "cross-site request refused" }, { status: 403 });
  }

  const body = await jsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const { slug, lesson } = await params;
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) {
    return NextResponse.json({ error: "no such class" }, { status: 404 });
  }
  if (!access.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!access.isStudent) {
    return NextResponse.json(
      {
        error: access.isTeacher
          ? "forbidden: instructors cannot submit homework"
          : "forbidden: not enrolled in this class",
      },
      { status: 403 },
    );
  }

  const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const cls = await getClassMeta(slug);
  const lsn = cls ? findLesson(cls, lesson) : null;
  if (!lsn) {
    return NextResponse.json({ error: "no such lesson in class" }, { status: 404 });
  }
  const assignment = findAssignmentInLesson(lsn, assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "no such assignment in this lesson" }, { status: 404 });
  }

  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  const configuredStoreId = getStoreIdFromToken(process.env.BLOB_READ_WRITE_TOKEN);
  if (!fileUrl || !isBlobUrl(fileUrl, configuredStoreId)) {
    return NextResponse.json(
      { error: "fileUrl must be a valid Vercel Blob URL from the configured store" },
      { status: 400 },
    );
  }

  const blobPathname = getBlobPathname(fileUrl);
  const expectedPrefix = submissionPrefix(slug, lesson, access.userId, assignmentId);
  const pathCheck = validateSubmissionPath(blobPathname, expectedPrefix);
  if (!pathCheck.valid) {
    return NextResponse.json({ error: pathCheck.error }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
  }

  // Pre-check existing submission before contacting storage
  let existing = null;
  try {
    existing = await prisma.notebookSubmission.findUnique({
      where: {
        userId_classId_lessonSlug_assignmentId: {
          userId: access.userId,
          classId: access.classRow.id,
          lessonSlug: lesson,
          assignmentId,
        },
      },
    });
  } catch (err: unknown) {
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
    throw err;
  }
  if (existing) {
    // If client retries submitting the exact same file, treat idempotently and NEVER delete it!
    if (isSameSubmissionFile(existing.fileUrl, fileUrl)) {
      return NextResponse.json({ submission: existing }, { status: 200 });
    }
    // Clean up the newly uploaded orphan only if it is strictly distinct from the recorded file
    if (!isSameSubmissionFile(existing.fileUrl, fileUrl)) {
      await del(fileUrl).catch(() => {});
    }
    return NextResponse.json({ error: "assignment already submitted" }, { status: 409 });
  }

  // Server-side verification of uploaded blob
  let blobMeta;
  try {
    blobMeta = await head(fileUrl);
  } catch {
    return NextResponse.json({ error: "uploaded blob not found in storage" }, { status: 400 });
  }

  if (blobMeta.pathname !== blobPathname) {
    return NextResponse.json(
      { error: "blob pathname does not match expected path" },
      { status: 400 },
    );
  }

  if (blobMeta.size <= 0 || blobMeta.size > MAX_SUBMISSION_BYTES) {
    await del(blobMeta.url).catch(() => {});
    return NextResponse.json(
      { error: `file size must be between 1 byte and ${MAX_SUBMISSION_BYTES / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }
  const fileBytes = blobMeta.size;
  const canonicalFileUrl = blobMeta.url;

  const rawFileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileName = sanitizeFileName(rawFileName, path.posix.basename(blobPathname));

  try {
    const maxGrade = assignment.maxScore ?? 100;
    const submission = await prisma.notebookSubmission.create({
      data: {
        userId: access.userId,
        classId: access.classRow.id,
        lessonSlug: lesson,
        assignmentId,
        fileUrl: canonicalFileUrl,
        fileName,
        fileBytes,
        status: "submitted",
        maxGrade,
      },
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err: unknown) {
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
    // Unique constraint race condition
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      // Re-read winner row to compare before touching storage
      const winner = await prisma.notebookSubmission.findUnique({
        where: {
          userId_classId_lessonSlug_assignmentId: {
            userId: access.userId,
            classId: access.classRow.id,
            lessonSlug: lesson,
            assignmentId,
          },
        },
      });
      if (winner) {
        if (isSameSubmissionFile(winner.fileUrl, canonicalFileUrl)) {
          return NextResponse.json({ submission: winner }, { status: 200 });
        }
        // NEVER delete winner.fileUrl! Only clean up the losing orphan upload if distinct
        if (!isSameSubmissionFile(winner.fileUrl, canonicalFileUrl)) {
          await del(canonicalFileUrl).catch(() => {});
        }
      }
      return NextResponse.json({ error: "assignment already submitted" }, { status: 409 });
    }
    throw err;
  }
}

/* GET — fetch submissions for this lesson.
 * Instructors see all submissions in the cohort; students see only their own.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug, lesson } = await params;
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible || !access.isMember) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const where: { classId: string; lessonSlug: string; userId?: string } = {
    classId: access.classRow.id,
    lessonSlug: lesson,
  };
  if (!access.isTeacher) {
    where.userId = access.userId!;
  }

  try {
    const submissions = await prisma.notebookSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        userId: true,
        classId: true,
        lessonSlug: true,
        assignmentId: true,
        fileName: true,
        fileBytes: true,
        submittedAt: true,
        status: true,
        grade: true,
        maxGrade: true,
        feedback: true,
        gradedBy: true,
        gradedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ submissions });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2021"
    ) {
      return NextResponse.json(
        {
          error: "notebook submissions are not enabled yet (database table missing)",
          unavailable: true,
          submissions: [],
        },
        { status: 503 },
      );
    }
    throw err;
  }
}
