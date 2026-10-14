import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findAssignmentInLesson,
  getBlobPathname,
  getStoreIdFromToken,
  isAuthorizedToDownload,
  isBlobUrl,
  isSameSubmissionFile,
  sanitizeFileName,
  SubmissionApiError,
  submissionPrefix,
  validateFeedback,
  validateGrade,
  validateSubmissionPath,
} from "../src/lib/submissions.ts";

test("getStoreIdFromToken extracts store ID from valid read-write tokens and handles edge cases", () => {
  assert.equal(getStoreIdFromToken("vercel_blob_rw_store123xyz_secretToken"), "store123xyz");
  assert.equal(getStoreIdFromToken("vercel_blob_rw_ABCDEF_token456"), "abcdef");
  assert.equal(getStoreIdFromToken("invalid_token"), null);
  assert.equal(getStoreIdFromToken(""), null);
  assert.equal(getStoreIdFromToken(null), null);
  assert.equal(getStoreIdFromToken(undefined), null);
});

test("isBlobUrl accepts valid Vercel Blob URLs, checks store ID, and rejects untrusted, alien, or forged URLs", () => {
  assert.equal(
    isBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/classes/ai/l01/file.ipynb"),
    true,
  );
  assert.equal(
    isBlobUrl("https://blob.vercel-storage.com/classes/ai/l01/file.ipynb"),
    true,
  );

  // Store ID matching
  assert.equal(
    isBlobUrl("https://store123.public.blob.vercel-storage.com/file.ipynb", "store123"),
    true,
  );
  // Rejects alien store ID
  assert.equal(
    isBlobUrl("https://alien999.public.blob.vercel-storage.com/file.ipynb", "store123"),
    false,
  );

  // Rejects stray query parameters or fragments
  assert.equal(
    isBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/classes/ai/l01/file.ipynb?download=1"),
    false,
  );
  assert.equal(
    isBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/classes/ai/l01/file.ipynb#section"),
    false,
  );

  // Insecure or forged origins
  assert.equal(
    isBlobUrl("http://abc123xyz.public.blob.vercel-storage.com/classes/ai/l01/file.ipynb"),
    false,
  );
  assert.equal(isBlobUrl("https://attacker.com/blob.vercel-storage.com/file.ipynb"), false);
  assert.equal(isBlobUrl("https://blob.vercel-storage.com.attacker.com/file.ipynb"), false);
  assert.equal(isBlobUrl("not-a-url"), false);
  assert.equal(isBlobUrl(""), false);
});

test("isSameSubmissionFile correctly identifies identical submission files", () => {
  const url1 = "https://store123.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/work.ipynb";
  const url2 = "https://store123.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/work.ipynb";
  const urlDifferentStorePrefix = "https://store123.public.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/work.ipynb";
  const urlDifferentFile = "https://store123.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/work_other.ipynb";

  assert.equal(isSameSubmissionFile(url1, url2), true);
  assert.equal(isSameSubmissionFile(url1, urlDifferentStorePrefix), true);
  assert.equal(isSameSubmissionFile(url1, urlDifferentFile), false);
  assert.equal(isSameSubmissionFile("", url1), false);
});

test("Regression Issue 1: idempotent retry must never delete already recorded submission file", () => {
  const recordedUrl = "https://store.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/file-recorded.ipynb";
  const incomingRetryUrl = "https://store.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/file-recorded.ipynb";
  const incomingSecondFileUrl = "https://store.blob.vercel-storage.com/classes/c1/l1/submissions/u1/a1/file-second.ipynb";

  const deletedUrls = [];
  const fakeDel = (url) => { deletedUrls.push(url); };

  // Case 1: Same URL posted twice (idempotent retry)
  function handleSubmissionCheck(existing, incoming) {
    if (existing) {
      if (isSameSubmissionFile(existing.fileUrl, incoming)) {
        return { status: 200, submission: existing };
      }
      if (!isSameSubmissionFile(existing.fileUrl, incoming)) {
        fakeDel(incoming);
      }
      return { status: 409, error: "assignment already submitted" };
    }
    return { status: 201 };
  }

  const existingRow = { id: "sub-1", fileUrl: recordedUrl };

  // Retrying the same URL
  const retryResult = handleSubmissionCheck(existingRow, incomingRetryUrl);
  assert.equal(retryResult.status, 200);
  assert.equal(deletedUrls.length, 0, "Recorded file must NOT be deleted on idempotent retry");

  // Attempting to submit a second, different file
  const secondResult = handleSubmissionCheck(existingRow, incomingSecondFileUrl);
  assert.equal(secondResult.status, 409);
  assert.equal(deletedUrls.length, 1);
  assert.equal(deletedUrls[0], incomingSecondFileUrl, "Only the new orphan file is cleaned up");
  assert.ok(!deletedUrls.includes(recordedUrl), "Recorded file must NEVER be deleted");
});

test("getBlobPathname decodes and strips leading slashes from blob URLs", () => {
  assert.equal(
    getBlobPathname("https://store.blob.vercel-storage.com/classes/ai%20agents/l01/hw.ipynb"),
    "classes/ai agents/l01/hw.ipynb",
  );
  assert.equal(
    getBlobPathname("https://store.blob.vercel-storage.com///nested/path.ipynb"),
    "nested/path.ipynb",
  );
});

test("submissionPrefix scopes path to class, lesson, student userId, and assignmentId", () => {
  assert.equal(
    submissionPrefix("agents", "l01", "usr_123", "assign_hw1"),
    "classes/agents/l01/submissions/usr_123/assign_hw1/",
  );
});

test("validateSubmissionPath enforces exact scoped prefix, rejects directory traversal, and requires .ipynb", () => {
  const prefix = "classes/agents/l01/submissions/usr_123/assign_hw1/";

  // Valid path
  assert.deepEqual(
    validateSubmissionPath(`${prefix}solution.ipynb`, prefix),
    { valid: true },
  );

  // Path traversal attempt
  assert.equal(
    validateSubmissionPath(`${prefix}../usr_999/solution.ipynb`, prefix).valid,
    false,
  );
  assert.equal(
    validateSubmissionPath(`classes/agents/l01/submissions/usr_123/../../etc/passwd.ipynb`, prefix).valid,
    false,
  );

  // Swapping another user's prefix
  const victimPrefix = "classes/agents/l01/submissions/usr_victim/assign_hw1/";
  assert.equal(
    validateSubmissionPath(`${victimPrefix}solution.ipynb`, prefix).valid,
    false,
  );

  // Wrong file extensions
  assert.equal(validateSubmissionPath(`${prefix}script.py`, prefix).valid, false);
  assert.equal(validateSubmissionPath(`${prefix}solution.json`, prefix).valid, false);
  assert.equal(validateSubmissionPath(`${prefix}payload.exe`, prefix).valid, false);
});

test("sanitizeFileName strips path segments, cleans special characters, and guarantees .ipynb extension", () => {
  assert.equal(sanitizeFileName("my_notebook.ipynb"), "my_notebook.ipynb");
  assert.equal(sanitizeFileName("../../../etc/passwd.ipynb"), "passwd.ipynb");
  assert.equal(
    sanitizeFileName("solution (1) [final]!.ipynb"),
    "solution__1___final__.ipynb",
  );
  assert.equal(sanitizeFileName("homework_without_ext"), "homework_without_ext.ipynb");
  assert.equal(sanitizeFileName(""), "submission.ipynb");
  assert.equal(sanitizeFileName("   "), "submission.ipynb");
  assert.equal(sanitizeFileName(".ipynb"), "submission.ipynb");
});

test("validateGrade validates integer boundaries, positive maxGrade, and rejects invalid types", () => {
  // Valid scores
  assert.deepEqual(validateGrade(100, 100), { valid: true, grade: 100, maxGrade: 100 });
  assert.deepEqual(validateGrade(0, 100), { valid: true, grade: 0, maxGrade: 100 });
  assert.deepEqual(validateGrade(42, 50), { valid: true, grade: 42, maxGrade: 50 });
  assert.deepEqual(validateGrade(85, undefined, 100), {
    valid: true,
    grade: 85,
    maxGrade: 100,
  });

  // Score exceeding max
  assert.equal(validateGrade(101, 100).valid, false);
  assert.equal(validateGrade(55, 50).valid, false);

  // Negative score
  assert.equal(validateGrade(-1, 100).valid, false);

  // Non-integer score
  assert.equal(validateGrade(95.5, 100).valid, false);

  // Booleans (critical: true / false must not coerce to 1 / 0)
  assert.equal(validateGrade(true, 100).valid, false);
  assert.equal(validateGrade(false, 100).valid, false);
  assert.equal(validateGrade(50, true).valid, false);
  assert.equal(validateGrade(50, false).valid, false);

  // Invalid maxGrade values
  assert.equal(validateGrade(50, -10).valid, false);
  assert.equal(validateGrade(50, 0).valid, false);
  assert.equal(validateGrade(50, 25.5).valid, false);
  assert.equal(validateGrade(50, "100").valid, false);

  // Invalid types
  assert.equal(validateGrade("80", 100).valid, false);
  assert.equal(validateGrade(null, 100).valid, false);
  assert.equal(validateGrade(NaN, 100).valid, false);
});

test("validateFeedback validates string feedback", () => {
  assert.deepEqual(validateFeedback("Great work!"), { valid: true, feedback: "Great work!" });
  assert.deepEqual(validateFeedback("  Padded comments  "), {
    valid: true,
    feedback: "Padded comments",
  });
  assert.deepEqual(validateFeedback(""), { valid: true, feedback: "" });

  assert.equal(validateFeedback(null).valid, false);
  assert.equal(validateFeedback(123).valid, false);
  assert.equal(validateFeedback(true).valid, false);
  assert.equal(validateFeedback({}).valid, false);
});

test("isAuthorizedToDownload allows teacher and author, rejects other students and guests", () => {
  // Teacher
  assert.equal(isAuthorizedToDownload("student-1", "teacher-1", true), true);
  assert.equal(isAuthorizedToDownload("student-1", null, true), true);

  // Student author
  assert.equal(isAuthorizedToDownload("student-1", "student-1", false), true);

  // Another student
  assert.equal(isAuthorizedToDownload("student-1", "student-2", false), false);

  // Anonymous guest
  assert.equal(isAuthorizedToDownload("student-1", null, false), false);
});

test("findAssignmentInLesson finds assignments in practice or homework items", () => {
  const lesson = {
    slug: "l01",
    title: "Lesson 1",
    date: null,
    deck: "d1",
    practice: [
      { type: "problem", id: "p1" },
      { type: "assignment", id: "practice-assign", title: "Practice Assignment" },
    ],
    homework: {
      due: "2026-10-20",
      items: [
        { type: "assignment", id: "hw-assign", title: "Homework Assignment", maxScore: 50 },
      ],
    },
  };

  const foundPractice = findAssignmentInLesson(lesson, "practice-assign");
  assert.equal(foundPractice?.id, "practice-assign");
  assert.equal(foundPractice?.title, "Practice Assignment");

  const foundHw = findAssignmentInLesson(lesson, "hw-assign");
  assert.equal(foundHw?.id, "hw-assign");
  assert.equal(foundHw?.maxScore, 50);

  const notFound = findAssignmentInLesson(lesson, "unknown-assign");
  assert.equal(notFound, null);
});

test("SubmissionApiError carries status code and message", () => {
  const err403 = new SubmissionApiError(403, "forbidden: not enrolled in this class");
  assert.equal(err403.status, 403);
  assert.equal(err403.message, "forbidden: not enrolled in this class");
  assert.equal(err403.name, "SubmissionApiError");

  const err409 = new SubmissionApiError(409, "assignment already submitted");
  assert.equal(err409.status, 409);
  assert.equal(err409.message, "assignment already submitted");
});
