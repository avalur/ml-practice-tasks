import type { NotebookSubmission, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { NotebookSubmissionData } from "@/lib/classes-shared";

/* NotebookSubmission reads shared by the pages. Two things every caller was
 * doing by hand:
 *
 * - turning a row into the client DTO (dates as ISO strings), and
 * - surviving a database where the table has not been pushed yet (Prisma's
 *   P2021). Such a deployment must not read as "nobody handed anything in", so
 *   the caller gets `unavailable: true` and says so instead. */

export function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

export function toSubmissionData(s: NotebookSubmission): NotebookSubmissionData {
  return {
    id: s.id,
    userId: s.userId,
    classId: s.classId,
    lessonSlug: s.lessonSlug,
    assignmentId: s.assignmentId,
    fileUrl: s.fileUrl,
    fileName: s.fileName,
    fileBytes: s.fileBytes,
    submittedAt: s.submittedAt.toISOString(),
    status: s.status,
    grade: s.grade,
    maxGrade: s.maxGrade,
    feedback: s.feedback,
    gradedBy: s.gradedBy,
    gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
  };
}

/** findMany that answers `unavailable` instead of throwing on a missing table. */
export async function findNotebookSubmissions(
  args: Prisma.NotebookSubmissionFindManyArgs,
): Promise<{ rows: NotebookSubmission[]; unavailable: boolean }> {
  try {
    return { rows: await prisma.notebookSubmission.findMany(args), unavailable: false };
  } catch (err) {
    if (isMissingTable(err)) return { rows: [], unavailable: true };
    throw err;
  }
}

/** The key the pages index submissions by. */
export const submissionKey = (classId: string, lessonSlug: string, assignmentId: string) =>
  `${classId}:${lessonSlug}:${assignmentId}`;
