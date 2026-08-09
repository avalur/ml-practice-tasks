import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  allRefs,
  codePrefix,
  flatten,
  getAccess,
  getClassMeta,
  isGroup,
  solvedKeys,
  type Item,
  type Lesson,
} from "@/lib/classes";
import { JoinClassForm } from "@/components/JoinClassForm";

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

  // Public: the course, its lessons and its tasks are readable by anyone. Only
  // the lecture notes and the teacher's own views are gated.
  const access = await getAccess(slug);
  if (!access.classRow) notFound();

  const refs = allRefs(cls);
  const [solved, endedRows] = await Promise.all([
    access.userId ? solvedKeys([access.userId], refs) : Promise.resolve(new Set<string>()),
    prisma.lessonSession.findMany({
      where: { classId: access.classRow.id, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: { lessonSlug: true, pdfUrl: true },
    }),
  ]);

  // Lessons that have actually been delivered, and those whose annotated PDF
  // finished uploading — the download itself goes through the notes route, which
  // signs a short-lived link to the private Blob object.
  const deliveredLessons = new Set(endedRows.map((r) => r.lessonSlug));
  const lessonsWithPdf = new Set(
    endedRows.filter((r) => r.pdfUrl).map((r) => r.lessonSlug),
  );

  const isDone = (type: string, id: string) =>
    !!access.userId && solved.has(`${access.userId}|${type}:${id}`);

  return (
    <article>
      <h1>{cls.title}</h1>
      <p className="muted">{cls.description}</p>

      {access.isTeacher && (
        <div className="class-teacher-bar">
          <span className="badge hard">teacher</span>
          <Link href={`/classes/${slug}/monitor`}>Live monitor</Link>
          <Link href={`/classes/${slug}/homework`}>Homework overview &amp; group codes</Link>
        </div>
      )}

      {/* Joining changes nothing about what you can read — it is how the teacher
          gets to see your homework, so it is offered rather than demanded. */}
      {!access.isTeacher &&
        (access.myGroup ? (
          <p className="muted">
            You are in this class as <strong>{access.myGroup.label}</strong> (code{" "}
            <code className="class-code">{access.myGroup.code}</code>). Your homework
            is visible to the teacher.
          </p>
        ) : access.userId ? (
          <JoinClassForm placeholder={`${codePrefix(slug)}…`} />
        ) : (
          <p className="muted">
            Everything here is open. <Link href="/api/auth/signin">Sign in</Link> and
            enter your teacher&rsquo;s group code if you want your homework counted.
          </p>
        ))}

      <ul className="class-lessons">
        {cls.lessons.map((lesson) => {
          const hwItems = flatten(lesson.homework?.items ?? []);
          const hwDone = hwItems.filter((r) => isDone(r.type, r.id)).length;
          const due = dueState(lesson);
          const delivered = deliveredLessons.has(lesson.slug);
          const hasPdf = lessonsWithPdf.has(lesson.slug);
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
                  {/* Notes are the one members-only thing here. */}
                  {hasPdf && access.isMember && (
                    <a
                      href={`/api/classes/${slug}/lessons/${lesson.slug}/notes`}
                      className="muted"
                    >
                      notes PDF
                    </a>
                  )}
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
                    {/* "0/26" is a progress bar with nothing behind it when
                        nobody is signed in — show the size of the assignment. */}
                    {access.userId ? `${hwDone}/${hwItems.length}` : `${hwItems.length} tasks`}
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
