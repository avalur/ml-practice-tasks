import type { NotebookSubmission } from "@prisma/client";

import { getAccess } from "@/lib/classes";
import { prisma } from "@/lib/db";
import { isAuthorizedToDownload } from "@/lib/submissions";

/* Who may read a submitted notebook — download it or view it rendered: its
 * author and the class's teachers, nobody else. Every refusal is the same
 * `null` (→ 404), so an outsider cannot tell a missing submission from one
 * they may not see. */
export async function readableSubmission(
  slug: string,
  lesson: string,
  id: string,
): Promise<NotebookSubmission | null> {
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible || !access.isMember) return null;

  const submission = await prisma.notebookSubmission.findFirst({
    where: { id, classId: access.classRow.id, lessonSlug: lesson },
  });
  if (!submission) return null;
  if (!isAuthorizedToDownload(submission.userId, access.userId, access.isTeacher)) return null;
  return submission;
}
