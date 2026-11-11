import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import {
  extractLessonAssignments,
  flatten,
  isAssignment,
  isDone,
  myClassSlugs,
  solvedKeys,
  visibleClasses,
  type ClassMeta,
  type EnrolledAssignment,
  type NotebookSubmissionData,
} from "@/lib/classes";
import {
  findNotebookSubmissions,
  submissionKey,
  toSubmissionData,
} from "@/lib/notebook-submissions";
import { visibleProblems } from "@/lib/problem";
import { dueMs, isOverdue } from "@/lib/classes-shared";

export { dueMs, isOverdue };

/* What the student cabinet (/profile/*) knows about the signed-in user.
 *
 * Everything here is derived, as everywhere else on the site: homework
 * completion from UserProblemProgress / UserNotebookProgress / NotebookSubmission,
 * never stored. "Student" means enrolled with a code and not teaching the class —
 * a teacher's own classes belong to /teach, not to their homework list. */

export const profileUser = cache(async function profileUser() {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? null, email: u.email ?? null, image: u.image ?? null };
});

const DAY_MS = 86_400_000;

export type HomeworkEntry = {
  classSlug: string;
  classTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  due: string | null;
  dueMs: number | null;
  done: number;
  total: number;
  /** Past its due date and not finished. */
  overdue: boolean;
};

export type StudentClass = {
  slug: string;
  title: string;
  description?: string;
  group: { code: string; label: string } | null;
  lessonCount: number;
  hwDone: number;
  hwTotal: number;
  /** The earliest unfinished homework that is not overdue yet, else the latest overdue one. */
  next: HomeworkEntry | null;
};

/** How a deadline should look: danger when overdue, warning within three days. */
export function dueTone(e: Pick<HomeworkEntry, "dueMs" | "done" | "total" | "overdue">) {
  if (e.done >= e.total) return "success" as const;
  if (e.overdue) return "danger" as const;
  if (e.dueMs !== null && e.dueMs - Date.now() < 3 * DAY_MS) return "warning" as const;
  return "neutral" as const;
}

/** Classes the user is a student of (visible ones only — a class back in draft
 * would be a dead link), with the group they joined. */
export const studentClasses = cache(async function studentClasses(userId: string) {
  const [visible, mine, enrollments] = await Promise.all([
    visibleClasses(),
    myClassSlugs(),
    prisma.classEnrollment.findMany({
      where: { userId },
      select: {
        class: { select: { id: true, slug: true } },
        invite: { select: { code: true, label: true } },
      },
    }),
  ]);
  const teaching = new Set(mine.teaching);
  const bySlug = new Map(enrollments.map((e) => [e.class.slug, e]));
  return visible
    .filter((c) => bySlug.has(c.slug) && !teaching.has(c.slug))
    .map((c) => ({
      meta: c as ClassMeta,
      classId: bySlug.get(c.slug)!.class.id,
      group: bySlug.get(c.slug)!.invite,
    }));
});

/** Homework progress per class and a flat list of every lesson's homework. */
export const studentHomework = cache(async function studentHomework(userId: string) {
  const classes = await studentClasses(userId);
  const now = Date.now();
  const entries: HomeworkEntry[] = [];
  const summaries: StudentClass[] = [];

  // Only homework is counted here, so only homework is read.
  const solvedPerClass = await Promise.all(
    classes.map((c) =>
      solvedKeys(
        [userId],
        flatten(c.meta.lessons.flatMap((l) => l.homework?.items ?? [])),
        { classId: c.classId },
      ),
    ),
  );
  let unavailable = false;

  classes.forEach(({ meta, classId, group }, i) => {
    const solved = solvedPerClass[i]!;
    // No NotebookSubmission table: an assignment cannot be told from "not handed
    // in", so it is left out of the counts rather than shown as overdue.
    const skipAssignments = !!solved.unavailable;
    unavailable ||= skipAssignments;
    let hwDone = 0;
    let hwTotal = 0;
    const mine: HomeworkEntry[] = [];
    for (const lesson of meta.lessons) {
      const items = flatten(lesson.homework?.items ?? []).filter(
        (r) => !(skipAssignments && isAssignment(r)),
      );
      if (items.length === 0) continue;
      const done = items.filter((r) =>
        isDone(solved, userId, r, { classId, lessonSlug: lesson.slug }),
      ).length;
      const due = dueMs(lesson.homework?.due);
      const entry: HomeworkEntry = {
        classSlug: meta.slug,
        classTitle: meta.title,
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        due: lesson.homework?.due ?? null,
        dueMs: due,
        done,
        total: items.length,
        overdue: done < items.length && isOverdue(due, now),
      };
      hwDone += done;
      hwTotal += items.length;
      mine.push(entry);
    }
    entries.push(...mine);
    const open = mine.filter((e) => e.done < e.total);
    const upcoming = open
      .filter((e) => !e.overdue)
      .sort((a, b) => (a.dueMs ?? Infinity) - (b.dueMs ?? Infinity));
    summaries.push({
      slug: meta.slug,
      title: meta.title,
      description: meta.description,
      group,
      lessonCount: meta.lessons.length,
      hwDone,
      hwTotal,
      next: upcoming[0] ?? open[open.length - 1] ?? null,
    });
  });

  // Overdue first (oldest first), then upcoming by date, finished ones last.
  const rank = (e: HomeworkEntry) => (e.done >= e.total ? 2 : e.overdue ? 0 : 1);
  entries.sort(
    (a, b) => rank(a) - rank(b) || (a.dueMs ?? Infinity) - (b.dueMs ?? Infinity),
  );
  return { classes: summaries, entries, unavailable };
});

export type AssignmentWithSubmission = EnrolledAssignment & {
  classId: string;
  submission: NotebookSubmissionData | null;
};

/** Every notebook assignment in the student's classes, with their submission. */
export const studentAssignments = cache(async function studentAssignments(userId: string) {
  const classes = await studentClasses(userId);
  const list: Array<EnrolledAssignment & { classId: string }> = [];
  for (const { meta, classId } of classes) {
    for (const lesson of meta.lessons) {
      for (const a of extractLessonAssignments(lesson, meta)) list.push({ ...a, classId });
    }
  }
  if (list.length === 0) return { items: [] as AssignmentWithSubmission[], unavailable: false };

  const { rows, unavailable } = await findNotebookSubmissions({
    where: { userId, classId: { in: classes.map((c) => c.classId) } },
  });
  const byKey = new Map(
    rows.map((s) => [submissionKey(s.classId, s.lessonSlug, s.assignmentId), toSubmissionData(s)]),
  );
  const items: AssignmentWithSubmission[] = list.map((a) => ({
    ...a,
    submission: byKey.get(submissionKey(a.classId, a.lessonSlug, a.assignment.id)) ?? null,
  }));
  return { items, unavailable };
});

export type AssignmentState = "todo" | "submitted" | "graded";

export function assignmentState(a: AssignmentWithSubmission): AssignmentState {
  if (!a.submission) return "todo";
  return a.submission.status === "graded" && a.submission.grade !== null ? "graded" : "submitted";
}

/** Solved / total per problem family (the topic prefix: py, numpy, …), in
 * manifest order. */
export async function trackProgress(userId: string) {
  const [manifest, solvedRows] = await Promise.all([
    getManifest(),
    prisma.userProblemProgress.findMany({
      where: { userId, clientSolved: true },
      select: { problemId: true },
    }),
  ]);
  const solved = new Set(solvedRows.map((r) => r.problemId));
  const families = new Map<string, { family: string; solved: number; total: number }>();
  let solvedTotal = 0;
  const problems = visibleProblems(manifest);
  for (const p of problems) {
    const family = p.topic.split("_")[0]!;
    const f = families.get(family) ?? { family, solved: 0, total: 0 };
    f.total += 1;
    if (solved.has(`${p.topic}/${p.slug}`)) {
      f.solved += 1;
      solvedTotal += 1;
    }
    families.set(family, f);
  }
  return { families: [...families.values()], solved: solvedTotal, total: problems.length };
}

export const FAMILY_LABEL: Record<string, string> = {
  py: "Python",
  numpy: "NumPy",
  pandas: "pandas",
  agents: "AI agents",
};
