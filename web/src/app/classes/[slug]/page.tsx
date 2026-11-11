import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  allRefs,
  codePrefix,
  flatten,
  dueMs,
  formatDay,
  formatMilestoneDate,
  isOverdue,
  getAccess,
  getClassMeta,
  isAssignment,
  isDone,
  isGroup,
  isLink,
  solvedKeys,
  type Item,
  type Lesson,
  type TrackableRef,
  type SolvedKeysResult,
} from "@/lib/classes";
import { JoinClassForm } from "@/components/JoinClassForm";
import { PublishToggle } from "@/components/PublishToggle";
import { ClassModeration } from "@/components/ClassModeration";
import { ReportClassButton } from "@/components/ReportClassButton";
import { ClassTeacherNav } from "@/components/ClassTeacherNav";
import { Badge, Notice, PageHeader } from "@/components/ui";

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

function dueState(lesson: Lesson, complete: boolean): { text: string; cls: string } | null {
  if (!lesson.homework) return null;
  const due = dueMs(lesson.homework.due);
  if (due === null) return null;
  return {
    text: `due ${formatDay(lesson.homework.due)}`,
    cls: complete ? "success" : isOverdue(due) ? "danger" : "neutral",
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

  const classId = access.classRow.id;
  const refs = allRefs(cls);
  const [solved, endedRows] = await Promise.all([
    access.userId
      ? solvedKeys([access.userId], refs, { classId })
      : Promise.resolve(new Set<string>()),
    prisma.lessonSession.findMany({
      where: { classId, endedAt: { not: null } },
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
  const submissionsUnavailable = Boolean((solved as SolvedKeysResult).unavailable);

  const checkDone = (lessonSlug: string, r: TrackableRef) =>
    !!access.userId &&
    isDone(solved, access.userId, r, {
      classId,
      lessonSlug,
    });

  return (
    <article>
      {access.isTeacher && (
        <p className="muted class-breadcrumb">
          <Link href="/teach">Teaching</Link> › {cls.title}
        </p>
      )}
      <PageHeader
        title={cls.title}
        subtitle={cls.description}
        actions={
          access.isTeacher && !access.suspended ? (
            <PublishToggle slug={slug} published={access.published} />
          ) : undefined
        }
      />
      {submissionsUnavailable && (
        <Notice tone="warning" testId="submissions-unavailable-notice">
          Notebook submissions are currently unavailable on this deployment (database table not
          migrated yet).
        </Notice>
      )}

      {access.isTeacher && (
        <>
          <ClassTeacherNav
            slug={slug}
            classId={classId}
            studio={access.studio}
            current="overview"
          />
          {!access.published && !access.suspended && (
            <Notice tone="warning" testId="draft-note">
              <Badge tone="warning">draft</Badge> Only you can see this class. Everything works —
              slides, present mode, practice links — it is just not listed anywhere public and
              its pages answer 404 to everyone else, students included. Publish when you are
              ready.
            </Notice>
          )}
        </>
      )}

      <ClassModeration slug={slug} access={access} />

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
          const hwDone = hwItems.filter((r) => checkDone(lesson.slug, r)).length;
          const due = dueState(lesson, hwItems.length > 0 && hwDone === hwItems.length);
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
                  {delivered && <span className="badge tone-success">delivered</span>}
                  {lesson.milestones && lesson.milestones.length > 0 && (
                    <a
                      href={`/classes/${slug}/${lesson.slug}/present.html`}
                      className="muted"
                    >
                      Open slides
                    </a>
                  )}
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

              {lesson.milestones && lesson.milestones.length > 0 && (
                <ul className="class-milestones" data-testid="class-milestones">
                  {lesson.milestones.map((milestone) => (
                    <li key={`${milestone.date}-${milestone.title}`}>
                      {milestone.kind === "deadline" ? "By " : ""}
                      {formatMilestoneDate(milestone.date)} — {milestone.title}
                      {milestone.tentative && (
                        <span className="badge tone-warning">
                          tentative
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

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
                      : isAssignment(item)
                      ? [
                          `assignment:${item.id}`,
                          `/classes/${slug}/lessons/${lesson.slug}`,
                          item.title,
                        ]
                      : [
                          `${item.type}:${item.id}`,
                          `/${item.type === "problem" ? "problems" : "notebooks"}/${item.id}`,
                          item.id,
                        ];
                    const solvedAll = flatten([item]).every((r) => checkDone(lesson.slug, r));
                    return (
                      <span key={key}>
                        {i > 0 && ", "}
                        <Link href={href}>
                          {solvedAll ? "✓ " : ""}
                          {label}
                        </Link>
                        {isAssignment(item) && (
                          <span
                            className={submissionsUnavailable ? "badge tone-neutral" : "badge tone-info"}
                          >
                            {submissionsUnavailable ? "assignment (unavailable)" : "assignment"}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>
              )}

              {hwItems.length > 0 && (
                <p className="class-lesson-line">
                  <span className="muted">Homework:</span>{" "}
                  <span className={`badge tone-${due?.cls ?? "neutral"}`}>
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

      {!access.isTeacher && <ReportClassButton slug={slug} signedIn={!!access.userId} />}
    </article>
  );
}
