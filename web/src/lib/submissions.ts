import path from "node:path";

export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024; // 25 MB
export const SUBMISSION_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const ALLOWED_SUBMISSION_MIME_TYPES = [
  "application/x-ipynb+json",
  "application/json",
  "text/plain",
  "application/octet-stream",
];

export class SubmissionApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SubmissionApiError";
  }
}

export type AssignmentInfo = {
  type: "assignment";
  id: string;
  title: string;
  templateHref?: string;
  maxScore?: number;
};

export type LessonWithAssignments = {
  practice?: unknown[];
  homework?: { items?: unknown[] } | null;
};

/** Extract store ID from a Vercel Blob read/write token (`vercel_blob_rw_<storeId>_<secret>`). */
export function getStoreIdFromToken(token?: string | null): string | null {
  if (!token) return null;
  const parts = token.trim().split("_");
  if (parts.length >= 4 && parts[0] === "vercel" && parts[1] === "blob") {
    return parts[3] ? parts[3].toLowerCase() : null;
  }
  return null;
}

/** Check if a URL points to Vercel Blob storage, optionally ensuring it matches our configured store.
 * Rejects stray query parameters or fragments.
 */
export function isBlobUrl(value: string, expectedStoreId?: string | null): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (u.search || u.hash) return false;

    const hostname = u.hostname.toLowerCase();
    if (
      hostname !== "blob.vercel-storage.com" &&
      !hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return false;
    }

    if (expectedStoreId) {
      const storePrefix = expectedStoreId.toLowerCase();
      if (!hostname.startsWith(`${storePrefix}.`)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** Normalized pathname in blob store from a full blob URL. */
export function getBlobPathname(blobUrl: string): string {
  const url = new URL(blobUrl);
  return decodeURIComponent(url.pathname).replace(/^\/+/, "");
}

/** Safe check whether two URLs refer to the exact same stored submission file. */
export function isSameSubmissionFile(urlA: string, urlB: string): boolean {
  if (!urlA || !urlB) return false;
  if (urlA === urlB) return true;
  try {
    return getBlobPathname(urlA) === getBlobPathname(urlB);
  } catch {
    return false;
  }
}

/** Canonical prefix for student submissions. Scoped by class, lesson, user, and assignment. */
export function submissionPrefix(
  classSlug: string,
  lessonSlug: string,
  userId: string,
  assignmentId: string,
): string {
  return `classes/${classSlug}/${lessonSlug}/submissions/${userId}/${assignmentId}/`;
}

/** Sanitize an uploaded file name, stripping path elements and ensuring .ipynb extension. */
export function sanitizeFileName(fileName: string, fallback?: string): string {
  const trimmed = (fileName || "").trim();
  const rawBase = (trimmed || fallback || "submission.ipynb").replace(/^.*[\\/]/, "");
  let cleaned = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleaned.endsWith(".ipynb")) {
    cleaned += ".ipynb";
  }
  if (cleaned === ".ipynb") {
    cleaned = "submission.ipynb";
  }
  return cleaned;
}

/** Validate blob pathname strictly against expected prefix and file requirements. */
export function validateSubmissionPath(
  pathname: string,
  expectedPrefix: string,
): { valid: boolean; error?: string } {
  if (pathname.includes("..")) {
    return { valid: false, error: "path traversal detected" };
  }
  if (!pathname.startsWith(expectedPrefix)) {
    return { valid: false, error: `pathname must sit under ${expectedPrefix}` };
  }
  if (!pathname.endsWith(".ipynb")) {
    return { valid: false, error: "file must have .ipynb extension" };
  }
  return { valid: true };
}

/** Validate grade score and optional maxGrade. Rejects booleans, non-integers, and out-of-range values. */
export function validateGrade(
  grade: unknown,
  maxGradeInput?: unknown,
  defaultMaxGrade = 100,
): { valid: boolean; error?: string; grade?: number; maxGrade?: number } {
  if (typeof grade === "boolean") {
    return { valid: false, error: "grade must be an integer" };
  }
  if (typeof grade !== "number" || !Number.isInteger(grade) || Number.isNaN(grade)) {
    return { valid: false, error: "grade must be an integer" };
  }
  if (grade < 0) {
    return { valid: false, error: "grade cannot be negative" };
  }

  let resolvedMax = defaultMaxGrade;
  if (maxGradeInput !== undefined && maxGradeInput !== null) {
    if (typeof maxGradeInput === "boolean") {
      return { valid: false, error: "maxGrade must be a positive integer" };
    }
    if (
      typeof maxGradeInput !== "number" ||
      !Number.isInteger(maxGradeInput) ||
      Number.isNaN(maxGradeInput)
    ) {
      return { valid: false, error: "maxGrade must be a positive integer" };
    }
    if (maxGradeInput <= 0) {
      return { valid: false, error: "maxGrade must be a positive integer" };
    }
    resolvedMax = maxGradeInput;
  }

  if (grade > resolvedMax) {
    return { valid: false, error: `grade cannot exceed maxGrade (${resolvedMax})` };
  }

  return { valid: true, grade, maxGrade: resolvedMax };
}

/** Validate teacher feedback text. */
export function validateFeedback(feedback: unknown): {
  valid: boolean;
  error?: string;
  feedback?: string;
} {
  if (typeof feedback !== "string") {
    return { valid: false, error: "feedback must be a string" };
  }
  return { valid: true, feedback: feedback.trim() };
}

/** Check if caller is authorized to download a student submission. */
export function isAuthorizedToDownload(
  submissionUserId: string,
  callerUserId: string | null,
  isTeacher: boolean,
): boolean {
  if (isTeacher) return true;
  if (callerUserId && callerUserId === submissionUserId) return true;
  return false;
}

/** Find assignment definition in a lesson structure. */
export function findAssignmentInLesson(
  lesson: LessonWithAssignments,
  assignmentId: string,
): AssignmentInfo | null {
  const all: unknown[] = [
    ...(Array.isArray(lesson.practice) ? lesson.practice : []),
    ...(Array.isArray(lesson.homework?.items) ? lesson.homework.items : []),
  ];
  for (const item of all) {
    if (typeof item === "object" && item !== null) {
      const rec = item as Record<string, unknown>;
      if (rec.type === "assignment" && rec.id === assignmentId) {
        return item as AssignmentInfo;
      }
    }
  }
  return null;
}
