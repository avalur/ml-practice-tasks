import { promises as fs } from "node:fs";
import path from "node:path";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Lesson structure is generated content, published to web/public/classes by
// export_decks.py (classes/ itself lives outside the web/ package and is not
// deployed). Authorization data — who teaches a class — comes from the DB
// instead, seeded by scripts/sync-classes.cjs.
const CLASSES_DIR = path.join(process.cwd(), "public", "classes");

export type ContentRef = { type: "problem" | "notebook"; id: string };

/** An `id` with a `*` in class.json, already expanded by export_decks.py.
 *
 * The point is the UI: "py_* → 26 tasks" is one line with a progress count, not
 * 26 rows. The members are still explicit here, so completion is counted exactly
 * as it is for a hand-listed item. */
export type GroupRef = {
  type: "group";
  of: "problem" | "notebook";
  pattern: string;
  title: string;
  items: ContentRef[];
};

export type Item = ContentRef | GroupRef;

export type Homework = { due: string; items: Item[] };

export type Lesson = {
  slug: string;
  title: string;
  date: string | null;
  deck: string;
  practice: Item[];
  homework: Homework | null;
};

export function isGroup(item: Item): item is GroupRef {
  return item.type === "group";
}

/** Flatten groups so counting and DB lookups only ever see real content refs. */
export function flatten(items: Item[]): ContentRef[] {
  return items.flatMap((i) => (isGroup(i) ? i.items : [i]));
}

export type ClassMeta = {
  slug: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
};

export async function getClasses(): Promise<ClassMeta[]> {
  const raw = await fs.readFile(path.join(CLASSES_DIR, "manifest.json"), "utf8");
  const parsed = JSON.parse(raw) as { classes: ClassMeta[] };
  return parsed.classes.sort((a, b) => a.order - b.order);
}

export async function getClassMeta(slug: string): Promise<ClassMeta | null> {
  const all = await getClasses();
  return all.find((c) => c.slug === slug) ?? null;
}

export function findLesson(cls: ClassMeta, lessonSlug: string): Lesson | null {
  return cls.lessons.find((l) => l.slug === lessonSlug) ?? null;
}

export function contentHref(ref: ContentRef): string {
  return `/${ref.type === "problem" ? "problems" : "notebooks"}/${ref.id}`;
}

/** Ordered list of every practice + homework item across a class, de-duplicated. */
export function allRefs(cls: ClassMeta): ContentRef[] {
  const seen = new Set<string>();
  const out: ContentRef[] = [];
  for (const lesson of cls.lessons) {
    for (const ref of flatten([...lesson.practice, ...(lesson.homework?.items ?? [])])) {
      const key = `${ref.type}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

/** Fingerprint of the deck a lesson currently renders.
 *
 * export_decks.py stamps it into the generated page, so reading it back here
 * keeps one source of truth. Stored on a LessonSession so ink drawn before a
 * deck edit can be flagged instead of silently landing in the wrong place.
 */
export async function deckHashFor(
  classSlug: string,
  lessonSlug: string,
): Promise<string> {
  try {
    const html = await fs.readFile(
      path.join(CLASSES_DIR, classSlug, lessonSlug, "present.html"),
      "utf8",
    );
    return /data-deck-hash="([^"]*)"/.exec(html)?.[1] ?? "";
  } catch {
    return "";
  }
}

// --- access control -------------------------------------------------------

/* Codes are dictated out loud and typed back from memory, so "TLF-OSEN-A",
 * "tlf osen a" and "tlfosena" all have to find the same group. Everything is
 * matched on this form; the teacher's spelling is kept only for display. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A starting point for a teacher writing a new code: the distinctive tail of
 * the class slug, e.g. "ml-intensive-tlf" → "TLF-". Only a suggestion — nothing
 * validates against it. */
export function codePrefix(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  const tail = parts[parts.length - 1] ?? slug;
  return `${tail.toUpperCase().slice(0, 6)}-`;
}

export type Access = {
  userId: string | null;
  email: string | null;
  classRow: { id: string; slug: string; title: string } | null;
  isTeacher: boolean;
  /** Enrolled with a code, or teaching. Classes themselves are public; this
   * gates the lecture notes and everything teacher-facing. */
  isMember: boolean;
  /** The group the caller joined with, when they joined with a code. */
  myGroup: { code: string; label: string } | null;
};

/** Resolve the caller's relationship to a class in one round trip. */
export async function getAccess(slug: string): Promise<Access> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email?.toLowerCase() ?? null;

  const row = await prisma.class.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      teacherEmails: true,
      // Not conditional on `userId`: a select that is sometimes `false` gives
      // this row two different shapes, and the caller then cannot read the
      // group off it. An impossible id costs one indexed miss instead.
      enrollments: {
        where: { userId: userId ?? "" },
        select: { invite: { select: { code: true, label: true } } },
        take: 1,
      },
    },
  });

  if (!row) {
    return {
      userId,
      email,
      classRow: null,
      isTeacher: false,
      isMember: false,
      myGroup: null,
    };
  }

  const isTeacher = !!email && row.teacherEmails.includes(email);
  const enrollment = userId ? row.enrollments[0] : undefined;
  return {
    userId,
    email,
    classRow: { id: row.id, slug: row.slug, title: row.title },
    isTeacher,
    isMember: isTeacher || !!enrollment,
    myGroup: enrollment?.invite ?? null,
  };
}

/** Class ids the user can see (enrolled in, or teaches). */
export async function myClassSlugs(): Promise<{ member: string[]; teaching: string[] }> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();
  if (!userId) return { member: [], teaching: [] };

  const [enrolled, teaching] = await Promise.all([
    prisma.classEnrollment.findMany({
      where: { userId },
      select: { class: { select: { slug: true } } },
    }),
    email
      ? prisma.class.findMany({
          where: { teacherEmails: { has: email } },
          select: { slug: true },
        })
      : Promise.resolve([]),
  ]);

  const teachingSlugs = teaching.map((c) => c.slug);
  const memberSlugs = enrolled.map((e) => e.class.slug);
  return {
    member: Array.from(new Set([...memberSlugs, ...teachingSlugs])),
    teaching: teachingSlugs,
  };
}

/** Which of `refs` a set of users has solved, as a set of "userId|type:id" keys.
 *
 * Homework completion is derived rather than stored, so this is the single place
 * that reads it: problems from UserProblemProgress, notebooks from
 * UserNotebookProgress.solvedAt.
 */
export async function solvedKeys(
  userIds: string[],
  refs: ContentRef[],
): Promise<Set<string>> {
  const problemIds = refs.filter((r) => r.type === "problem").map((r) => r.id);
  const notebookIds = refs.filter((r) => r.type === "notebook").map((r) => r.id);
  const out = new Set<string>();
  if (userIds.length === 0) return out;

  const [problems, notebooks] = await Promise.all([
    problemIds.length
      ? prisma.userProblemProgress.findMany({
          where: {
            userId: { in: userIds },
            problemId: { in: problemIds },
            clientSolved: true,
          },
          select: { userId: true, problemId: true },
        })
      : Promise.resolve([]),
    notebookIds.length
      ? prisma.userNotebookProgress.findMany({
          where: {
            userId: { in: userIds },
            notebookId: { in: notebookIds },
            solvedAt: { not: null },
          },
          select: { userId: true, notebookId: true },
        })
      : Promise.resolve([]),
  ]);

  for (const p of problems) out.add(`${p.userId}|problem:${p.problemId}`);
  for (const n of notebooks) out.add(`${n.userId}|notebook:${n.notebookId}`);
  return out;
}

/** Every enrolled member of a class, for the roster and the live feed. */
export async function classRoster(classId: string) {
  const rows = await prisma.classEnrollment.findMany({
    where: { classId },
    orderBy: { joinedAt: "asc" },
    select: {
      joinedAt: true,
      invite: { select: { code: true, label: true } },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return rows.map((r) => ({ ...r.user, joinedAt: r.joinedAt, group: r.invite }));
}

/** The students of a class: everyone who actually typed an invite code.
 *
 * Teachers are enrolled too (sync-classes.cjs puts them in their own roster),
 * but they never typed a code, so they are not students and do not belong in
 * the homework overview. Sorted by group, then by name, so cohorts read as
 * blocks. */
export async function classStudents(classId: string) {
  const rows = await classRoster(classId);
  return rows
    .filter((r) => r.group)
    .sort(
      (a, b) =>
        a.group!.label.localeCompare(b.group!.label) ||
        (a.name || a.email || "").localeCompare(b.name || b.email || ""),
    );
}

/** Invite codes of a class with how many students came in on each. */
export async function classInvites(classId: string) {
  const rows = await prisma.classInvite.findMany({
    where: { classId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      label: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    createdAt: r.createdAt,
    students: r._count.enrollments,
  }));
}
