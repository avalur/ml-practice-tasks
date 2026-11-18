import path from "node:path";

export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024; // 25 MB
export const SUBMISSION_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const ALLOWED_SUBMISSION_MIME_TYPES = [
  "application/x-ipynb+json",
  "application/json",
  "text/plain",
  "application/octet-stream",
];

/* The server half of SUBMISSION_FORMATS in classes-shared.ts: the extension a
 * stored path must end in, and the content types the upload token allows.
 * A notebook arrives under whatever type the browser guesses for .ipynb (often
 * none); a PDF is application/pdf everywhere, so nothing looser is let in. */
export type SubmissionFormat = "ipynb" | "pdf";

export const SUBMISSION_FORMAT_RULES: Record<SubmissionFormat, { ext: string; mimeTypes: string[] }> = {
  ipynb: { ext: ".ipynb", mimeTypes: ALLOWED_SUBMISSION_MIME_TYPES },
  pdf: { ext: ".pdf", mimeTypes: ["application/pdf"] },
};

const DEFAULT_FORMATS: SubmissionFormat[] = ["ipynb"];

/** The formats an assignment takes, from class.json's `accept`; absent or unknown means a notebook. */
export function assignmentFormats(assignment?: { accept?: unknown } | null): SubmissionFormat[] {
  const raw = Array.isArray(assignment?.accept) ? assignment.accept : [];
  const list = raw.filter(
    (f): f is SubmissionFormat => typeof f === "string" && Object.hasOwn(SUBMISSION_FORMAT_RULES, f),
  );
  return list.length ? list : DEFAULT_FORMATS;
}

/** Content types the upload token may accept for these formats. */
export function allowedMimeTypes(formats: readonly SubmissionFormat[]): string[] {
  return [...new Set(formats.flatMap((f) => SUBMISSION_FORMAT_RULES[f].mimeTypes))];
}

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
  accept?: SubmissionFormat[];
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

/** Sanitize an uploaded file name: strip path elements and end it in one of the
 * accepted extensions, lower-cased, adding the first one when it has none.
 * Mirrors the client copy in classes-shared.ts. */
export function sanitizeFileName(
  fileName: string,
  fallback?: string,
  formats: readonly SubmissionFormat[] = DEFAULT_FORMATS,
): string {
  const exts = formats.map((f) => SUBMISSION_FORMAT_RULES[f].ext);
  const trimmed = (fileName || "").trim();
  const rawBase = (trimmed || fallback || `submission${exts[0]}`).replace(/^.*[\\/]/, "");
  let cleaned = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = exts.find((e) => cleaned.toLowerCase().endsWith(e)) ?? exts[0];
  cleaned = cleaned.toLowerCase().endsWith(ext) ? cleaned.slice(0, -ext.length) + ext : cleaned + ext;
  if (cleaned === ext) {
    cleaned = `submission${ext}`;
  }
  return cleaned;
}

/** Validate blob pathname strictly against expected prefix and the assignment's formats. */
export function validateSubmissionPath(
  pathname: string,
  expectedPrefix: string,
  formats: readonly SubmissionFormat[] = DEFAULT_FORMATS,
): { valid: boolean; error?: string } {
  if (pathname.includes("..")) {
    return { valid: false, error: "path traversal detected" };
  }
  if (!pathname.startsWith(expectedPrefix)) {
    return { valid: false, error: `pathname must sit under ${expectedPrefix}` };
  }
  const exts = formats.map((f) => SUBMISSION_FORMAT_RULES[f].ext);
  if (!exts.some((e) => pathname.endsWith(e))) {
    return {
      valid: false,
      error:
        exts.length === 1
          ? `file must have ${exts[0]} extension`
          : `file must have one of these extensions: ${exts.join(", ")}`,
    };
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
