import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import {
  findAssignmentInLesson,
  validateFeedback,
  validateGrade,
} from "@/lib/submissions";

type RouteParams = {
  params: Promise<{ slug: string; lesson: string; id: string }>;
};

/* POST — records teacher grade and markdown feedback for a student notebook submission.
 *
 * Security & authorization:
 * - Cross-site and JSON body guards on cookie mutation
 * - Strictly authorized for course teachers via DB (Class.teacherEmails)
 * - Validates integer score, positive maxGrade bounds, and string feedback
 * - Sets submission status to "graded", records teacher identity and timestamp.
 */
export async function POST(req: Request, { params }: RouteParams) {
  if (crossSite(req)) {
    return NextResponse.json({ error: "cross-site request refused" }, { status: 403 });
  }

  const body = await jsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const { slug, lesson, id } = await params;
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!access.isTeacher) {
    return NextResponse.json({ error: "forbidden: teachers only" }, { status: 403 });
  }

  const submission = await prisma.notebookSubmission.findFirst({
    where: {
      id,
      classId: access.classRow.id,
      lessonSlug: lesson,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  const cls = await getClassMeta(slug);
  if (!cls) {
    return NextResponse.json({ error: "class not found" }, { status: 404 });
  }
  const lessonObj = findLesson(cls, lesson);
  if (!lessonObj) {
    return NextResponse.json({ error: "lesson not found" }, { status: 404 });
  }

  // Authoritative maxScore from course definition in class.json
  const assignment = findAssignmentInLesson(lessonObj, submission.assignmentId);
  if (!assignment) {
    return NextResponse.json(
      { error: "assignment not found in lesson definition" },
      { status: 404 },
    );
  }
  const authoritativeMaxScore = assignment.maxScore ?? 100;

  if (
    body.maxGrade !== undefined &&
    body.maxGrade !== null &&
    body.maxGrade !== authoritativeMaxScore
  ) {
    return NextResponse.json(
      { error: `maxGrade must match assignment maxScore (${authoritativeMaxScore})` },
      { status: 400 },
    );
  }

  const gradeValidation = validateGrade(body.grade, authoritativeMaxScore, authoritativeMaxScore);
  if (!gradeValidation.valid) {
    return NextResponse.json({ error: gradeValidation.error }, { status: 400 });
  }

  const feedbackValidation = validateFeedback(body.feedback);
  if (!feedbackValidation.valid) {
    return NextResponse.json({ error: feedbackValidation.error }, { status: 400 });
  }

  const updated = await prisma.notebookSubmission.update({
    where: { id: submission.id },
    data: {
      status: "graded",
      grade: gradeValidation.grade,
      maxGrade: authoritativeMaxScore,
      feedback: feedbackValidation.feedback,
      gradedBy: access.email ?? access.userId ?? "Teacher",
      gradedAt: new Date(),
    },
  });

  return NextResponse.json({ submission: updated });
}
