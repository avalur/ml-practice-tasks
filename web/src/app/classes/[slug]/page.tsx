import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  allRefs,
  flatten,
  getAccess,
  getClassMeta,
  isGroup,
  solvedKeys,
  type Item,
  type Lesson,
} from "@/lib/classes";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cls = await getClassMeta(slug);
  return { title: cls ? `${cls.title} — ML Practice` : "Class" };
}

function dueState(lesson: Lesson): { text: string; cls: string } | null {
  if (!lesson.homework) return null;
  const due = new Date(lesson.homework.due);
  if (Number.isNaN(due.getTime())) return null;
  const overdue = due.getTime() < Date.now();
  return {
    text: `due ${due.toLocaleDateString([], { day: "numeric", month: "short" })}`,
    cls: overdue ? "medium" : "easy",
  };
}

export default async function ClassPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const cls = await getClassMeta(slug);
  if (!cls) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  if (!access.isMember) {
    return (
      <article>
        <h1>{cls.title}</h1>
        <p className="muted">
          You are not in this class. Ask your teacher for the invite code, then
          enter it on the <Link href="/classes">Classes</Link> page.
        </p>
      </article>
    );
  }

  const refs = allRefs(cls);
  const [solved, endedRows] = await Promise.all([
    access.userId ? solvedKeys([access.userId], refs) : Promise.resolve(new Set<string>()),
    prisma.lessonSession.findMany({
      where: { classId: access.classRow.id, endedAt: { not: null } },
      select: { lessonSlug: true },
      distinct: ["lessonSlug"],
    }),
  ]);

  // Lessons that have actually been delivered. The PDF itself is not hosted here
  // — the teacher downloads it and shares it directly.
  const deliveredLessons = new Set(endedRows.map((r) => r.lessonSlug));

  const isDone = (type: string, id: string) =>
    !!access.userId && solved.has(`${access.userId}|${type}:${id}`);

  return (
    <article>
      <h1>{cls.title}</h1>
      <p className="muted">{cls.description}</p>

      {access.isTeacher && (
        <div className="class-teacher-bar">
          <span className="badge hard">teacher</span>
          <span className="muted">
            Invite code: <code className="class-code">{access.classRow.inviteCode}</code>
          </span>
          <Link href={`/classes/${slug}/monitor`}>Live monitor</Link>
          <Link href={`/classes/${slug}/homework`}>Homework overview</Link>
        </div>
      )}

      <ul className="class-lessons">
        {cls.lessons.map((lesson) => {
          const hwItems = flatten(lesson.homework?.items ?? []);
          const hwDone = hwItems.filter((r) => isDone(r.type, r.id)).length;
          const due = dueState(lesson);
          const delivered = deliveredLessons.has(lesson.slug);
          return (
            <li key={lesson.slug} className="class-lesson">
              <div className="class-lesson-head">
                <Link
                  href={`/classes/${slug}/lessons/${lesson.slug}`}
                  className="class-lesson-title"
                >
                  {lesson.title}
                </Link>
                <span className="meta">
                  {lesson.date && <span className="muted">{lesson.date}</span>}
                  {delivered && <span className="badge easy">delivered</span>}
                </span>
              </div>

              {lesson.practice.length > 0 && (
                <p className="class-lesson-line">
                  <span className="muted">In class:</span>{" "}
                  {lesson.practice.map((item: Item, i) => {
                    // A group has no page of its own; the lesson is where it opens.
                    const [key, href, label] = isGroup(item)
                      ? [
                          `group:${item.pattern}`,
                          `/classes/${slug}/lessons/${lesson.slug}`,
                          `${item.title} (${item.items.length})`,
                        ]
                      : [
                          `${item.type}:${item.id}`,
                          `/${item.type === "problem" ? "problems" : "notebooks"}/${item.id}`,
                          item.id,
                        ];
                    const solvedAll = flatten([item]).every((r) => isDone(r.type, r.id));
                    return (
                      <span key={key}>
                        {i > 0 && ", "}
                        <Link href={href}>
                          {solvedAll ? "✓ " : ""}
                          {label}
                        </Link>
                      </span>
                    );
                  })}
                </p>
              )}

              {hwItems.length > 0 && (
                <p className="class-lesson-line">
                  <span className="muted">Homework:</span>{" "}
                  <span className={`badge ${due?.cls ?? "easy"}`}>
                    {hwDone}/{hwItems.length}
                    {due ? ` · ${due.text}` : ""}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
