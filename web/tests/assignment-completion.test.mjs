import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assignmentKey,
  assignmentSubmissionWhere,
  hasAssignmentSubmission,
} from "../src/lib/assignment-completion.ts";

test("assignment completion is isolated to the matching class and lesson", () => {
  const solved = new Set([assignmentKey("student-1", "class-a", "lesson-a", "hw1")]);

  assert.equal(
    hasAssignmentSubmission(solved, "student-1", "hw1", {
      classId: "class-a",
      lessonSlug: "lesson-a",
    }),
    true,
  );
  assert.equal(
    hasAssignmentSubmission(solved, "student-1", "hw1", {
      classId: "class-b",
      lessonSlug: "lesson-a",
    }),
    false,
  );
  assert.equal(
    hasAssignmentSubmission(solved, "student-1", "hw1", {
      classId: "class-a",
      lessonSlug: "lesson-b",
    }),
    false,
  );
  assert.equal(hasAssignmentSubmission(solved, "student-1", "hw1", { classId: "class-a" }), false);
});

test("assignment lookup filters by class and adds lesson scope when supplied", () => {
  assert.deepEqual(
    assignmentSubmissionWhere(["student-1"], ["hw1", "hw2"], { classId: "class-a" }),
    {
      userId: { in: ["student-1"] },
      classId: "class-a",
      assignmentId: { in: ["hw1", "hw2"] },
    },
  );
  assert.deepEqual(
    assignmentSubmissionWhere(["student-1"], ["hw1"], {
      classId: "class-a",
      lessonSlug: "lesson-a",
    }),
    {
      userId: { in: ["student-1"] },
      classId: "class-a",
      lessonSlug: "lesson-a",
      assignmentId: { in: ["hw1"] },
    },
  );
});