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
  isLink,
  solvedKeys,
  type Item,
  type Lesson,
} from "@/lib/classes";
import { JoinClassForm } from "@/components/JoinClassForm";
import { PublishToggle } from "@/components/PublishToggle";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [cls, access] = await Promise.all([getClassMeta(slug), getAccess(slug)]);
  // Same gate as the page: a draft class must not put its title in a <title>.
  return { title: cls && access.visible ? `${cls.title} — ML Practice` : "Class" };
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

  // Public once published: the course, its lessons and its tasks are then
  // readable by anyone, and only the lecture notes and the teacher's own views
  // are gated. Before that the class belongs to its teachers alone.
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) notFound();

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
        <>
          <div className="class-teacher-bar">
            <span className="badge hard">teacher</span>
            <Link href={`/classes/${slug}/monitor`}>Live monitor</Link>
            <Link href={`/classes/${slug}/homework`}>Homework overview &amp; group codes</Link>
            <PublishToggle slug={slug} published={access.published} />
          </div>
          {!access.published && (
            <p className="class-draft-note" data-testid="draft-note">
              <span className="badge medium">draft</span> Only you can see this class.
              Everything works — slides, present mode, practice links — it is just not
              listed anywhere public and its pages answer 404 to everyone else, students
              included. Publish when you are ready.
            </p>
          )}
        </>
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
            Everything here is open.{" "}
            <Link href={`/signin?next=${encodeURIComponent(`/classes/${slug}`)}`}>Sign in</Link> and
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
                    // An off-site link is opened, never solved. Checking it for
                    // completion would tick it: flatten() drops links, and
                    // [].every() is true.
                    if (isLink(item)) {
                      return (
                        <span key={`link:${item.href}`}>
                          {i > 0 && ", "}
                          <a href={item.href} target="_blank" rel="noopener noreferrer">
                            {item.title}
                          </a>
                        </span>
                      );
                    }
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
