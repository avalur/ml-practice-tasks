import { prisma } from "@/lib/db";
import {
  allRefs,
  classStudents,
  extractLessonAssignments,
  flatten,
  getClasses,
  isAssignment,
  isDone,
  myClassSlugs,
  solvedKeys,
  type ClassMeta,
  type Lesson,
} from "@/lib/classes";
import { findNotebookSubmissions } from "@/lib/notebook-submissions";

/* What the teaching dashboard (/teach) and the class Grading tab know.
 *
 * "Teaching" is Class.teacherEmails, as everywhere: the repo classes a teacher
 * was seeded into and the studio courses they own. Nothing here is stored —
 * completion is derived exactly as the homework matrix derives it. */

export type TeachingClass = {
  slug: string;
  title: string;
  status: "published" | "draft" | "suspended";
  studio: boolean;
  listed: boolean;
  students: number;
  toGrade: number;
  /** done / total over every (student × homework task), for lessons already due. */
  homework: { done: number; total: number } | null;
  nextLesson: { slug: string; title: string; date: string } | null;
  lessonCount: number;
};

export type GradingItem = {
  id: string;
  classSlug: string;
  classTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  assignmentTitle: string;
  student: string;
  submittedAt: Date;
  status: string;
  grade: number | null;
  maxGrade: number | null;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/** The first lesson dated today or later. Dates are plain "YYYY-MM-DD". */
export function nextLesson(lessons: Lesson[]): Lesson | null {
  const today = todayStr();
  return (
    lessons
      .filter((l) => l.date && l.date >= today)
      .sort((a, b) => a.date!.localeCompare(b.date!))[0] ?? null
  );
}

async function homeworkRate(cls: ClassMeta, classId: string) {
  const lessons = cls.lessons.filter(
    (l) => (l.homework?.items.length ?? 0) > 0 && new Date(l.homework!.due).getTime() < Date.now(),
  );
  if (lessons.length === 0) return null;
  const students = await classStudents(classId);
  if (students.length === 0) return null;
  const ids = students.map((s) => s.id);
  const solved = await solvedKeys(ids, allRefs(cls), { classId });
  // A missing NotebookSubmission table would count every assignment as undone;
  // leave them out rather than report a class that failed.
  const skipAssignments = !!(solved as { unavailable?: boolean }).unavailable;
  let done = 0;
  let total = 0;
  for (const l of lessons) {
    const refs = flatten(l.homework!.items).filter((r) => !(skipAssignments && isAssignment(r)));
    for (const id of ids) {
      for (const r of refs) {
        total += 1;
        if (isDone(solved, id, r, { classId, lessonSlug: l.slug })) done += 1;
      }
    }
  }
  return total > 0 ? { done, total } : null;
}

export async function teachingOverview() {
  const [{ teaching }, all] = await Promise.all([myClassSlugs(), getClasses()]);
  if (teaching.length === 0) return { classes: [] as TeachingClass[], grading: [] as GradingItem[], gradingUnavailable: false };

  const metas = new Map(all.map((c) => [c.slug, c]));
  const rows = await prisma.class.findMany({
    where: { slug: { in: teaching } },
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      suspendedAt: true,
      source: true,
      featuredAt: true,
      _count: { select: { enrollments: { where: { inviteId: { not: null } } } } },
    },
  });

  const grading = await gradingQueue(rows.map((r) => ({ id: r.id, slug: r.slug })), metas, {
    pendingOnly: true,
  });
  const pendingByClass = new Map<string, number>();
  for (const g of grading.items) pendingByClass.set(g.classSlug, (pendingByClass.get(g.classSlug) ?? 0) + 1);

  const classes = await Promise.all(
    rows.map(async (r): Promise<TeachingClass> => {
      const meta = metas.get(r.slug);
      const next = meta ? nextLesson(meta.lessons) : null;
      return {
        slug: r.slug,
        title: meta?.title ?? r.title,
        status: r.suspendedAt ? "suspended" : r.publishedAt ? "published" : "draft",
        studio: r.source === "studio",
        listed: r.source !== "studio" || r.featuredAt !== null,
        students: r._count.enrollments,
        toGrade: pendingByClass.get(r.slug) ?? 0,
        homework: meta ? await homeworkRate(meta, r.id) : null,
        nextLesson: next ? { slug: next.slug, title: next.title, date: next.date! } : null,
        lessonCount: meta?.lessons.length ?? 0,
      };
    }),
  );
  // Classes with a lesson coming up first, then by title.
  classes.sort(
    (a, b) =>
      (a.nextLesson?.date ?? "9999").localeCompare(b.nextLesson?.date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
  return { classes, grading: grading.items, gradingUnavailable: grading.unavailable };
}

/** Notebook submissions of these classes, oldest waiting first. */
export async function gradingQueue(
  classes: Array<{ id: string; slug: string }>,
  metas: Map<string, ClassMeta>,
  opts: { pendingOnly?: boolean; take?: number } = {},
): Promise<{ items: GradingItem[]; unavailable: boolean }> {
  if (classes.length === 0) return { items: [], unavailable: false };
  const slugById = new Map(classes.map((c) => [c.id, c.slug]));
  const { rows, unavailable } = await findNotebookSubmissions({
    where: {
      classId: { in: classes.map((c) => c.id) },
      ...(opts.pendingOnly ? { status: "submitted" } : {}),
    },
    orderBy: opts.pendingOnly ? { submittedAt: "asc" } : { submittedAt: "desc" },
    take: opts.take ?? 200,
  });
  if (rows.length === 0) return { items: [], unavailable };

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const who = new Map(users.map((u) => [u.id, u.name || u.email || "student"]));

  const items: GradingItem[] = rows.map((s) => {
    const slug = slugById.get(s.classId)!;
    const meta = metas.get(slug);
    const lesson = meta?.lessons.find((l) => l.slug === s.lessonSlug);
    const assignment =
      lesson && meta
        ? extractLessonAssignments(lesson, meta).find((a) => a.assignment.id === s.assignmentId)
        : undefined;
    return {
      id: s.id,
      classSlug: slug,
      classTitle: meta?.title ?? slug,
      lessonSlug: s.lessonSlug,
      lessonTitle: lesson?.title ?? s.lessonSlug,
      assignmentTitle: assignment?.assignment.title ?? s.assignmentId,
      student: who.get(s.userId) ?? "student",
      submittedAt: s.submittedAt,
      status: s.status,
      grade: s.grade,
      maxGrade: s.maxGrade,
    };
  });
  return { items, unavailable };
}
