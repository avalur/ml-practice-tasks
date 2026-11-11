import path from "node:path";
import { randomUUID } from "node:crypto";
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
import { isMissingTable } from "@/lib/notebook-submissions";

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
 * - Handles concurrent submit races while retaining only the latest version
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

  // Pre-check existing submission before contacting storage — and before
  // requiring it: both answers below come from the database alone, so neither
  // may fail just because no Blob store is set up.
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
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "notebook submissions are not enabled yet (database table missing)" },
        { status: 503 },
      );
    }
    throw err;
  }
  if (existing && isSameSubmissionFile(existing.fileUrl, fileUrl)) {
    // A client retry for the already-recorded blob must not reset grading.
    return NextResponse.json({ submission: existing }, { status: 200 });
  }

  // Everything below talks to the store.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
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

  const where = {
    userId_classId_lessonSlug_assignmentId: {
      userId: access.userId,
      classId: access.classRow.id,
      lessonSlug: lesson,
      assignmentId,
    },
  };
  const maxGrade = assignment.maxScore ?? 100;
  const submissionData = {
    fileUrl: canonicalFileUrl,
    fileName,
    fileBytes,
    submittedAt: new Date(),
    status: "submitted",
    grade: null,
    maxGrade,
    feedback: null,
    gradedBy: null,
    gradedAt: null,
  };

  // Optimistically replace the version we observed. If another submit wins first,
  // reread and retry; the unique key continues to identify one current submission.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const current = await prisma.notebookSubmission.findUnique({ where });
      if (current && isSameSubmissionFile(current.fileUrl, canonicalFileUrl)) {
        return NextResponse.json({ submission: current }, { status: 200 });
      }

      if (!current) {
        const submission = await prisma.notebookSubmission.create({
          data: {
            userId: access.userId,
            classId: access.classRow.id,
            lessonSlug: lesson,
            assignmentId,
            ...submissionData,
          },
        });
        return NextResponse.json({ submission }, { status: 201 });
      }

      const replaced = await prisma.notebookSubmission.updateMany({
        where: { id: current.id },
        data: { id: randomUUID(), ...submissionData },
      });
      if (replaced.count === 0) continue;

      const submission = await prisma.notebookSubmission.findUnique({ where });
      if (submission) {
        return NextResponse.json({ submission }, { status: 200 });
      }
    } catch (err: unknown) {
      if (isMissingTable(err)) {
        return NextResponse.json(
          { error: "notebook submissions are not enabled yet (database table missing)" },
          { status: 503 },
        );
      }
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "submission changed concurrently; please try again" },
    { status: 409 },
  );
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
    if (isMissingTable(err)) {
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
