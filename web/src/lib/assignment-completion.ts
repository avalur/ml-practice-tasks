/** Scope for resolving notebook submissions. Matches DB uniqueness:
 * (userId, classId, lessonSlug, assignmentId).
 */
export type AssignmentScope = {
  classId?: string;
  lessonSlug?: string;
};

export type AssignmentQueryScope = AssignmentScope & { classId: string };

/** Assignment completion key format matching DB uniqueness. */
export function assignmentKey(
  userId: string,
  classId: string,
  lessonSlug: string,
  assignmentId: string,
): string {
  return `${userId}|${classId}|${lessonSlug}|assignment:${assignmentId}`;
}

/** An assignment is done only when a submission exists in its exact class and lesson. */
export function hasAssignmentSubmission(
  solved: Set<string>,
  userId: string,
  assignmentId: string,
  scope?: AssignmentScope,
): boolean {
  if (!scope?.classId || !scope.lessonSlug) return false;
  return solved.has(assignmentKey(userId, scope.classId, scope.lessonSlug, assignmentId));
}

/** Prisma filter for class-wide views or a single lesson. */
export function assignmentSubmissionWhere(
  userIds: string[],
  assignmentIds: string[],
  scope: AssignmentQueryScope,
) {
  return {
    userId: { in: userIds },
    classId: scope.classId,
    ...(scope.lessonSlug ? { lessonSlug: scope.lessonSlug } : {}),
    assignmentId: { in: assignmentIds },
  };
}