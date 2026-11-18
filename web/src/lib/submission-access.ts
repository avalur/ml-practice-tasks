import type { NotebookSubmission } from "@prisma/client";
import { issueSignedToken, presignUrl } from "@vercel/blob";

import { getAccess } from "@/lib/classes";
import { prisma } from "@/lib/db";
import {
  getBlobPathname,
  isAuthorizedToDownload,
  SUBMISSION_LINK_TTL_MS,
} from "@/lib/submissions";

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

/* A 10-minute GET link to a submission in the private store. The bytes never
 * pass through our function; callers redirect to it after `readableSubmission`
 * said yes. Throws when the store cannot sign (no token, network). */
export async function signedSubmissionUrl(fileUrl: string): Promise<string> {
  const pathname = getBlobPathname(fileUrl);
  const validUntil = Date.now() + SUBMISSION_LINK_TTL_MS;
  const signed = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  // `access: "private"` must be explicit, or the host comes out as
  // <store>.undefined.blob.vercel-storage.com.
  const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname, access: "private" });
  return presignedUrl;
}
