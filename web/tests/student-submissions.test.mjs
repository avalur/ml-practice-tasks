import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveMaxScore,
  extractLessonAssignments,
  formatBytes,
  formatDate,
  lessonMatrixItems,
  sanitizeFileName,
  submissionPrefix,
  getDownloadEndpoint,
  validateNotebookFile,
} from "../src/lib/classes-shared.ts";
import {
  assignmentKey,
  hasAssignmentSubmission,
  assignmentSubmissionWhere,
} from "../src/lib/assignment-completion.ts";
import {
  isAuthorizedToDownload,
  validateSubmissionPath,
  MAX_SUBMISSION_BYTES,
} from "../src/lib/submissions.ts";
import { renderFeedbackMarkdown } from "../src/lib/feedback-render.ts";

test("extractLessonAssignments: correctly extracts homework and practice assignments", () => {
  const lesson = {
    slug: "l02-tools-mcp",
    title: "Lecture 2. Tools and MCP",
    practice: [
      { type: "problem", id: "py_functional/lru_cache" },
      { type: "link", title: "Colab Practice", href: "https://colab.research.google.com" },
      { type: "assignment", id: "practice-agent", title: "Practice ReAct Agent", maxScore: 50 },
    ],
    homework: {
      due: "2026-10-20T23:59:00Z",
      items: [
        { type: "assignment", id: "intro-react-agent", title: "Build a ReAct Agent", maxScore: 100 },
        { type: "assignment", id: "practice-agent", title: "Duplicate Practice Agent", maxScore: 50 },
      ],
    },
  };

  const cls = {
    slug: "building-ai-agents",
    title: "Building AI Agents",
  };

  const result = extractLessonAssignments(lesson, cls);
  assert.equal(result.length, 2);

  // Homework assignment first
  assert.deepEqual(result[0], {
    classSlug: "building-ai-agents",
    classTitle: "Building AI Agents",
    lessonSlug: "l02-tools-mcp",
    lessonTitle: "Lecture 2. Tools and MCP",
    assignment: {
      type: "assignment",
      id: "intro-react-agent",
      title: "Build a ReAct Agent",
      maxScore: 100,
    },
    isHomework: true,
    due: "2026-10-20T23:59:00Z",
  });

  // Practice assignment deduplicated (since practice-agent was in homework items, it was added as homework)
  assert.equal(result[1].assignment.id, "practice-agent");
  assert.equal(result[1].isHomework, true);
});

test("extractLessonAssignments: handles lessons with practice only or homework only", () => {
  const practiceOnlyLesson = {
    slug: "l01-intro",
    title: "Lesson 1",
    practice: [
      { type: "assignment", id: "asg-1", title: "Warmup Assignment" },
    ],
    homework: null,
  };

  const cls = { slug: "ml-course", title: "ML Course" };
  const res1 = extractLessonAssignments(practiceOnlyLesson, cls);
  assert.equal(res1.length, 1);
  assert.equal(res1[0].isHomework, false);
  assert.equal(res1[0].due, null);

  const emptyLesson = {
    slug: "l02-empty",
    title: "Lesson 2",
    practice: [],
    homework: { due: "2026-11-01", items: [] },
  };
  const res2 = extractLessonAssignments(emptyLesson, cls);
  assert.equal(res2.length, 0);
});

test("submissionPrefix: formats canonical prefix scoped by class, lesson, user, assignment", () => {
  const prefix = submissionPrefix("building-ai-agents", "l02-tools", "usr_123", "react-agent");
  assert.equal(prefix, "classes/building-ai-agents/l02-tools/submissions/usr_123/react-agent/");
});

test("sanitizeFileName: cleans paths, handles extensions and whitespace safely", () => {
  assert.equal(sanitizeFileName("my_notebook.ipynb"), "my_notebook.ipynb");
  assert.equal(sanitizeFileName("../../../etc/shadow.ipynb"), "shadow.ipynb");
  assert.equal(sanitizeFileName("test solution (v2) [final]!.ipynb"), "test_solution__v2___final__.ipynb");
  assert.equal(sanitizeFileName("homework_no_extension"), "homework_no_extension.ipynb");
  assert.equal(sanitizeFileName(""), "submission.ipynb");
  assert.equal(sanitizeFileName("   "), "submission.ipynb");
  assert.equal(sanitizeFileName(".ipynb"), "submission.ipynb");
});

test("formatBytes: formats byte values into readable B, KB, and MB", () => {
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(250 * 1024), "250.0 KB");
  assert.equal(formatBytes(1024 * 1024), "1.0 MB");
  assert.equal(formatBytes(15.5 * 1024 * 1024), "15.5 MB");
});

test("formatDate: safely formats strings and Date objects", () => {
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
  const d = new Date("2026-10-13T12:00:00Z");
  assert.ok(formatDate(d).length > 0);
  assert.ok(formatDate("2026-10-13T12:00:00Z").length > 0);
});

test("validateNotebookFile: pure shared validator enforces .ipynb extension, non-empty, and 25MB maximum", () => {
  assert.equal(
    validateNotebookFile("solution.py", 1024).error,
    "Only Jupyter Notebook (.ipynb) files are accepted.",
  );
  assert.equal(
    validateNotebookFile("solution.txt", 1024).error,
    "Only Jupyter Notebook (.ipynb) files are accepted.",
  );
  assert.equal(
    validateNotebookFile("solution.ipynb.zip", 1024).error,
    "Only Jupyter Notebook (.ipynb) files are accepted.",
  );
  assert.equal(validateNotebookFile("solution.IPYNB", 1024).valid, true);
  assert.equal(validateNotebookFile("solution.ipynb", 0).error, "File cannot be empty.");
  assert.equal(
    validateNotebookFile("solution.ipynb", 26 * 1024 * 1024).error,
    "File size (26.0 MB) exceeds the 25 MB limit.",
  );
  assert.equal(validateNotebookFile("solution.ipynb", 10 * 1024 * 1024).valid, true);
});

test("effectiveMaxScore: authoritative assignment definition takes precedence", () => {
  assert.equal(effectiveMaxScore(50, 100), 50);
  assert.equal(effectiveMaxScore(undefined, 80), 80);
  assert.equal(effectiveMaxScore(null, 75), 75);
  assert.equal(effectiveMaxScore(undefined, null), 100);
});

test("formatDate: deterministic UTC formatting prevents hydration mismatch", () => {
  const d1 = "2026-10-13T14:30:00.000Z";
  assert.equal(formatDate(d1), "Oct 13, 2026, 14:30 UTC");
  assert.equal(formatDate(new Date(d1)), "Oct 13, 2026, 14:30 UTC");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
  assert.equal(formatDate("invalid-date"), "invalid-date");
});

test("lessonMatrixItems: merges homework items and practice assignments without duplicates", () => {
  const lesson = {
    practice: [
      { type: "problem", id: "py_basics/sum" },
      { type: "assignment", id: "hw1", title: "Practice HW1", maxScore: 50 },
      { type: "link", title: "Colab", href: "https://colab.research.google.com" },
    ],
    homework: {
      due: "2026-10-20T23:59:00Z",
      items: [
        { type: "problem", id: "py_basics/sum" },
        { type: "assignment", id: "hw1", title: "HW1", maxScore: 100 },
      ],
    },
  };
  const items = lessonMatrixItems(lesson);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "py_basics/sum");
  assert.equal(items[1].id, "hw1");
  assert.equal(items[1].maxScore, 100);
});

test("hasAssignmentSubmission & assignmentKey: strictly scoped to classId and lessonSlug", () => {
  const key = assignmentKey("user-1", "class-ai", "l01-intro", "agent-hw");
  assert.equal(key, "user-1|class-ai|l01-intro|assignment:agent-hw");

  const solvedSet = new Set([key]);
  assert.equal(
    hasAssignmentSubmission(solvedSet, "user-1", "agent-hw", {
      classId: "class-ai",
      lessonSlug: "l01-intro",
    }),
    true,
  );
  assert.equal(
    hasAssignmentSubmission(solvedSet, "user-1", "agent-hw", {
      classId: "other-class",
      lessonSlug: "l01-intro",
    }),
    false,
  );
  assert.equal(
    hasAssignmentSubmission(solvedSet, "user-1", "agent-hw", {
      classId: "class-ai",
      lessonSlug: "l02-tools",
    }),
    false,
  );
  assert.equal(hasAssignmentSubmission(solvedSet, "user-1", "agent-hw"), false);
});

test("assignmentSubmissionWhere: generates scoped Prisma query filter", () => {
  const where = assignmentSubmissionWhere(["u1", "u2"], ["asg1"], {
    classId: "cls1",
    lessonSlug: "l1",
  });
  assert.deepEqual(where, {
    userId: { in: ["u1", "u2"] },
    classId: "cls1",
    lessonSlug: "l1",
    assignmentId: { in: ["asg1"] },
  });
});

test("validateSubmissionPath: verifies destination path against expected prefix", () => {
  const prefix = "classes/cls1/l1/submissions/u1/asg1/";
  assert.deepEqual(validateSubmissionPath("classes/cls1/l1/submissions/u1/asg1/solution.ipynb", prefix), { valid: true });
  assert.equal(validateSubmissionPath("classes/cls1/l1/submissions/u1/asg1/../evil.ipynb", prefix).valid, false);
  assert.equal(validateSubmissionPath("classes/cls2/l1/submissions/u1/asg1/solution.ipynb", prefix).valid, false);
  assert.equal(validateSubmissionPath("classes/cls1/l1/submissions/u1/asg1/solution.pdf", prefix).valid, false);
});

test("getDownloadEndpoint & isAuthorizedToDownload: author and teacher can download, strangers cannot", () => {
  const url = getDownloadEndpoint("class-1", "lesson-1", "sub-100");
  assert.equal(url, "/api/classes/class-1/lessons/lesson-1/submissions/sub-100/download");

  assert.equal(isAuthorizedToDownload("student-a", "student-a", false), true);
  assert.equal(isAuthorizedToDownload("student-a", "student-b", false), false);
  assert.equal(isAuthorizedToDownload("student-a", "student-b", true), true);
  assert.equal(isAuthorizedToDownload("student-a", null, false), false);
});

test("student feedback presentation: renders score, date, and sanitized markdown feedback", () => {
  const feedbackMarkdown = "### Review\nGreat work implementing the agent loop!\n\n$$\\text{Score} = 95$$\n\n`code_block`";
  const rendered = renderFeedbackMarkdown(feedbackMarkdown);

  assert.ok(rendered.includes("<h3"));
  assert.ok(rendered.includes("Great work implementing the agent loop!"));
  assert.ok(rendered.includes("katex"));
  assert.ok(rendered.includes("code_block"));
});
