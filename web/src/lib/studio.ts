import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import { isPlatformTeacher } from "@/lib/teachers";
import notebookManifest from "../../../notebooks/manifest.json";
import type { ClassMeta, Item, Lesson, TrackedItem } from "./classes-shared";
import {
  STUDIO_LIMITS,
  type StudioHomeworkInput,
  type StudioItemInput,
} from "./studio-shared";

export * from "./studio-shared";

/* Courses built on the site (Class.source = "studio").
 *
 * The rest of the app never asks which kind of class it is looking at: both
 * kinds come out of getClasses() as the same ClassMeta, so the class page,
 * homework, monitor, attendance, notebook submissions and present mode all work
 * unchanged. What differs is only where the structure comes from — the
 * published manifest for repo courses, StudioLesson rows here — and where the
 * slides are served from (a route, not a static file; see deck-shell.ts). */

// ------------------------------------------------------------------ catalogue

/** Every problem and notebook id a lesson may point at. */
export const contentIds = cache(async function contentIds() {
  const manifest = await getManifest();
  const problems = new Set(manifest.problems.map((p) => p.id));
  const notebooks = new Set<string>();
  for (const sec of (notebookManifest as { sections: { slug: string; notebooks: { slug: string }[] }[] })
    .sections) {
    for (const nb of sec.notebooks) notebooks.add(`${sec.slug}/${nb.slug}`);
  }
  return { problems, notebooks };
});

/** fnmatch, as export_decks.py uses it: `*` also crosses the `/`, so
 * "py_basics/*" is one topic and "py_*" is every topic starting with py_. */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function groupTitle(pattern: string, ids: string[]): string {
  const topics = [...new Set(ids.map((i) => i.split("/")[0]))].sort();
  if (topics.length === 1) return topics[0];
  const prefix = pattern.split("*")[0].replace(/[_/]+$/, "");
  return prefix ? `${prefix}_*` : pattern;
}

const ASSIGNMENT_ID = /^[a-z0-9][a-z0-9_-]*$/;
const absoluteHref = (h: unknown): h is string =>
  typeof h === "string" && /^(https?:\/\/|\/)/.test(h) && !h.startsWith("//");

/** Resolve one entry the way export_decks.py's expand_item does, so a studio
 * lesson and a repo lesson can never disagree about what an item means. */
export function expandItem(
  item: StudioItemInput,
  ids: { problems: Set<string>; notebooks: Set<string> },
  allowLinks: boolean,
): { item: Item | null; error: string | null } {
  if (item.type === "link") {
    if (!allowLinks) return { item: null, error: `a link cannot be homework — ${item.title}` };
    if (!item.title?.trim()) return { item: null, error: "a link needs a title" };
    if (!absoluteHref(item.href)) return { item: null, error: `link “${item.title}” needs an http(s) address` };
    return { item: { type: "link", title: item.title.trim(), href: item.href }, error: null };
  }
  if (item.type === "assignment") {
    if (typeof item.id !== "string" || !ASSIGNMENT_ID.test(item.id)) {
      return { item: null, error: `assignment id must be a lowercase slug, got ${JSON.stringify(item.id)}` };
    }
    if (!item.title?.trim()) return { item: null, error: `assignment ${item.id} needs a title` };
    const out: Item = { type: "assignment", id: item.id, title: item.title.trim() };
    if (item.templateHref !== undefined) {
      if (!absoluteHref(item.templateHref)) return { item: null, error: `assignment ${item.id}: bad template link` };
      out.templateHref = item.templateHref;
    }
    if (item.maxScore !== undefined) {
      if (!Number.isInteger(item.maxScore) || item.maxScore <= 0) {
        return { item: null, error: `assignment ${item.id}: maxScore must be a positive integer` };
      }
      out.maxScore = item.maxScore;
    }
    return { item: out, error: null };
  }
  if (item.type !== "problem" && item.type !== "notebook") {
    return { item: null, error: `unknown item type ${JSON.stringify((item as { type: unknown }).type)}` };
  }
  const pool = item.type === "problem" ? ids.problems : ids.notebooks;
  if (typeof item.id !== "string") return { item: null, error: "item id must be a string" };
  if (!item.id.includes("*")) {
    if (!pool.has(item.id)) return { item: null, error: `unknown ${item.type} ${item.id}` };
    return { item: { type: item.type, id: item.id }, error: null };
  }
  const re = globToRegExp(item.id);
  const matched = [...pool].filter((id) => re.test(id)).sort();
  if (matched.length === 0) return { item: null, error: `pattern ${item.id} matches no ${item.type}` };
  return {
    item: {
      type: "group",
      of: item.type,
      pattern: item.id,
      title: item.title || groupTitle(item.id, matched),
      items: matched.map((id) => ({ type: item.type, id })),
    },
    error: null,
  };
}

/** Validate a whole practice list / homework as the editor submits it. Returns
 * the cleaned input (what is stored) and every error found. */
export async function validateLessonItems(
  practice: unknown,
  homework: unknown,
): Promise<{ practice: StudioItemInput[]; homework: StudioHomeworkInput; errors: string[] }> {
  const ids = await contentIds();
  const errors: string[] = [];
  const asList = (v: unknown, where: string): StudioItemInput[] => {
    if (!Array.isArray(v)) {
      errors.push(`${where} must be a list`);
      return [];
    }
    if (v.length > STUDIO_LIMITS.items) errors.push(`${where}: at most ${STUDIO_LIMITS.items} entries`);
    return v.filter((x): x is StudioItemInput => typeof x === "object" && x !== null && "type" in x);
  };

  const cleanPractice = asList(practice ?? [], "practice");
  for (const it of cleanPractice) {
    const { error } = expandItem(it, ids, true);
    if (error) errors.push(`practice: ${error}`);
  }

  let cleanHomework: StudioHomeworkInput = null;
  if (homework !== null && homework !== undefined) {
    const hw = homework as { due?: unknown; items?: unknown };
    const due = typeof hw.due === "string" ? hw.due : "";
    if (!/^\d{4}-\d{2}-\d{2}/.test(due) || Number.isNaN(new Date(due).getTime())) {
      errors.push("homework needs a due date (YYYY-MM-DD)");
    }
    const items = asList(hw.items ?? [], "homework");
    for (const it of items) {
      const { error } = expandItem(it, ids, false);
      if (error) errors.push(`homework: ${error}`);
    }
    cleanHomework = { due, items };
  }

  // Assignment ids key submissions per lesson; the same id may appear in
  // practice and homework (that is one assignment), but not as two different ones.
  const titles = new Map<string, string>();
  for (const i of [...cleanPractice, ...(cleanHomework?.items ?? [])]) {
    if (i.type !== "assignment") continue;
    const prev = titles.get(i.id);
    if (prev !== undefined && prev !== i.title) errors.push(`assignment ${i.id} is declared twice with different titles`);
    titles.set(i.id, i.title);
  }

  return { practice: cleanPractice, homework: cleanHomework, errors };
}

// ------------------------------------------------------------- the ClassMeta

type StudioRow = {
  slug: string;
  title: string;
  description: string | null;
  createdAt: Date;
  studioLessons: {
    slug: string;
    title: string;
    date: string | null;
    practice: unknown;
    homework: unknown;
  }[];
};

function toLesson(
  l: StudioRow["studioLessons"][number],
  ids: { problems: Set<string>; notebooks: Set<string> },
): Lesson {
  const expand = (items: unknown, allowLinks: boolean): Item[] =>
    (Array.isArray(items) ? (items as StudioItemInput[]) : [])
      .map((i) => expandItem(i, ids, allowLinks).item)
      // A task that has since left the catalogue drops out instead of
      // breaking the lesson — the editor shows it as an error to fix.
      .filter((i): i is Item => i !== null);
  const hw = l.homework as { due: string; items: StudioItemInput[] } | null;
  return {
    slug: l.slug,
    title: l.title,
    date: l.date,
    deck: l.slug,
    practice: expand(l.practice, true),
    homework: hw
      ? { due: hw.due, items: expand(hw.items, false) as TrackedItem[] }
      : null,
  };
}

/** Every studio course as a ClassMeta, once per request. Ordered after the
 * repo courses, oldest first. Visibility is not decided here: the same
 * getAccess()/visibleClasses() gates apply to both kinds. */
export const studioClassMetas = cache(async function studioClassMetas(): Promise<ClassMeta[]> {
  let rows: StudioRow[];
  try {
    rows = await prisma.class.findMany({
      where: { source: "studio" },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        title: true,
        description: true,
        createdAt: true,
        studioLessons: {
          orderBy: { position: "asc" },
          select: { slug: true, title: true, date: true, practice: true, homework: true },
        },
      },
    });
  } catch {
    // An unmigrated database (no `source` column yet) must not take the repo
    // courses down with it.
    return [];
  }
  const ids = await contentIds();
  return rows.map((r, i) => ({
    slug: r.slug,
    title: r.title,
    description: r.description ?? "",
    order: 1000 + i,
    lessons: r.studioLessons.map((l) => toLesson(l, ids)),
  }));
});

// ------------------------------------------------------------------- editing

const currentSession = cache(auth);

export type StudioClassRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: Date | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  featuredAt: Date | null;
};

/** The studio course the caller may edit, or why not. Editing needs the live
 * platform role *and* ownership — a revoked teacher keeps their published
 * course running (students are mid-term) but cannot change it. */
export async function editableClass(
  slug: string,
): Promise<{ ok: true; userId: string; email: string; cls: StudioClassRow } | { ok: false; status: number; error: string }> {
  const session = await currentSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();
  if (!userId || !email) return { ok: false, status: 401, error: "unauthorized" };
  if (!(await isPlatformTeacher())) return { ok: false, status: 403, error: "teacher role required" };
  const cls = await prisma.class.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      publishedAt: true,
      suspendedAt: true,
      suspendedReason: true,
      featuredAt: true,
      source: true,
      ownerId: true,
      teacherEmails: true,
    },
  });
  if (!cls || cls.source !== "studio") return { ok: false, status: 404, error: "no such course" };
  if (cls.ownerId !== userId && !cls.teacherEmails.includes(email)) {
    return { ok: false, status: 404, error: "no such course" };
  }
  return { ok: true, userId, email, cls };
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "course"
  );
}

/** A course slug: readable, plus a random tail so an unlisted course cannot be
 * found by guessing its title. */
export function newCourseSlug(title: string): string {
  return `${slugify(title)}-${randomBytes(4).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 5)}`;
}

/** Lesson slugs mirror the repo convention: l01-intro, l02-…. Reserved words
 * are the path segments the class routes already use. */
export function newLessonSlug(position: number, title: string): string {
  return `l${String(position + 1).padStart(2, "0")}-${slugify(title).slice(0, 30)}`;
}

export function deckHash(deck: string): string {
  return createHash("sha256").update(deck).digest("hex").slice(0, 16);
}

/** The raster type of an image, from its magic bytes — never from what the
 * uploader declared. Null for anything else (SVG included: opened directly it
 * is a document that can run script). */
export function sniffImage(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString("latin1"))) return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
