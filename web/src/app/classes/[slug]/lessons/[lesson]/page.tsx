import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  findLesson,
  flatten,
  formatDay,
  formatMilestoneDate,
  getAccess,
  getClassMeta,
  isAssignment,
  isDone,
  solvedKeys,
  type NotebookSubmissionData,
  type SolvedKeysResult,
  type TrackableRef,
} from "@/lib/classes";
import { findNotebookSubmissions, toSubmissionData } from "@/lib/notebook-submissions";
import { PresentButton } from "@/components/PresentButton";
import { ClassModeration } from "@/components/ClassModeration";
import { ReportClassButton } from "@/components/ReportClassButton";
import { ClassTeacherNav } from "@/components/ClassTeacherNav";
import { RefList } from "@/components/LessonItems";
import { Badge, PageHeader, ProgressBar } from "@/components/ui";

type Params = { slug: string; lesson: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, lesson } = await params;
  const [cls, access] = await Promise.all([getClassMeta(slug), getAccess(slug)]);
  const l = cls && findLesson(cls, lesson);
  // Same gate as the page: a draft lesson must not put its title in a <title>.
  return { title: l && access.visible ? `${l.title} — ML Practice` : "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { slug, lesson: lessonSlug } = await params;
  const cls = await getClassMeta(slug);
  const lesson = cls && findLesson(cls, lessonSlug);
  if (!cls || !lesson) notFound();

  // Public once the class is published, like the class page. The annotated
  // lecture notes are the exception: those are for the students who joined a
  // group.
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) notFound();

  const classId = access.classRow.id;
  const refs = flatten([...lesson.practice, ...(lesson.homework?.items ?? [])]);
  const hasAssignments = refs.some(isAssignment);

  const [solved, delivered, attendance, userSubmissions] = await Promise.all([
    access.userId
      ? solvedKeys([access.userId], refs, {
          classId,
          lessonSlug,
        })
      : Promise.resolve(new Set<string>()),
    prisma.lessonSession.findFirst({
      where: { classId, lessonSlug, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: { pdfBytes: true, pdfUrl: true, endedAt: true },
    }),
    access.userId
      ? prisma.lessonAttendance.findUnique({
          where: {
            classId_lessonSlug_userId: {
              classId,
              lessonSlug,
              userId: access.userId,
            },
          },
          select: { attended: true },
        })
      : Promise.resolve(null),
    hasAssignments && access.userId
      ? findNotebookSubmissions({ where: { userId: access.userId, classId, lessonSlug } })
      : Promise.resolve({ rows: [], unavailable: false }),
  ]);

  const submissionsUnavailable =
    Boolean((solved as SolvedKeysResult).unavailable) || userSubmissions.unavailable;
  const subMap = new Map<string, NotebookSubmissionData>(
    userSubmissions.rows.map((s) => [s.assignmentId, toSubmissionData(s)]),
  );

  const done = (r: TrackableRef) =>
    !!access.userId &&
    isDone(solved, access.userId, r, {
      classId,
      lessonSlug,
    });
  const hwRefs = flatten(lesson.homework?.items ?? []);
  const slidesUrl = `/classes/${slug}/${lessonSlug}/present.html`;
  const hwDone = hwRefs.filter(done).length;

  return (
    <article>
      <p className="muted class-breadcrumb">
        {access.isTeacher ? (
          <>
            <Link href="/teach">Teaching</Link> ›{" "}
          </>
        ) : (
          <>
            <Link href="/classes">Classes</Link> ›{" "}
          </>
        )}
        <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <PageHeader
        title={lesson.title}
        subtitle={lesson.date ? formatDay(lesson.date, { year: true }) : undefined}
      />
      {access.isTeacher && (
        <ClassTeacherNav
          slug={slug}
          classId={classId}
          studio={access.studio}
          current="overview"
        />
      )}

      {lesson.milestones && lesson.milestones.length > 0 && (
        <section className="class-milestones" data-testid="class-milestones">
          <h2>Project timeline</h2>
          <ul>
            {lesson.milestones.map((milestone) => (
              <li key={`${milestone.date}-${milestone.title}`}>
                {milestone.kind === "deadline" ? "By " : ""}
                {formatMilestoneDate(milestone.date)} — {milestone.title}
                {milestone.tentative && <Badge tone="warning">tentative</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ClassModeration slug={slug} access={access} />

      <div className="class-lesson-actions">
        <a className="btn subtle small" href={slidesUrl} target="_blank" rel="noopener">
          Open slides
        </a>
        {access.isTeacher && <PresentButton classSlug={slug} lessonSlug={lessonSlug} />}
        {access.isTeacher && (
          <Link
            className="btn subtle small"
            href={`/classes/${slug}/homework?lesson=${lessonSlug}`}
          >
            Attendance
          </Link>
        )}
        {attendance?.attended && <Badge tone="success">✓ Attended</Badge>}
        {/* "Finish lesson" saves the annotated PDF to the teacher's machine and
            uploads a copy to Blob storage; this appears once that copy lands.
            The store is private, so the link goes through our own route, which
            checks membership and signs a short-lived download URL. */}
        {delivered?.pdfUrl && access.isMember && (
          <a
            className="btn subtle small"
            href={`/api/classes/${slug}/lessons/${lessonSlug}/notes`}
            data-testid="lecture-pdf"
          >
            Download notes (PDF
            {delivered.pdfBytes
              ? `, ${Math.round(delivered.pdfBytes / 104857.6) / 10} MB`
              : ""}
            )
          </a>
        )}
      </div>

      <p className="muted">
        {delivered?.endedAt
          ? `Delivered ${formatDay(delivered.endedAt, { year: true })}` +
            (delivered.pdfUrl
              ? access.isMember
                ? " — the lecture notes above are the slides with everything written on them in class."
                : " — the annotated lecture notes go to the students of this class; join your group on the class page to get them."
              : delivered.pdfBytes
                ? " — notes exported by the teacher, but not published here."
                : ".")
          : access.isTeacher
            ? "Not delivered yet. “Finish lesson” in present mode saves a PDF of every slide with your notes to your downloads and publishes a copy here."
            : "Lecture notes appear here after the lesson."}
      </p>

      {lesson.practice.length > 0 && (
        <section className="lesson-section">
          <h2>In-class practice</h2>
          <RefList
            items={lesson.practice}
            done={done}
            classSlug={slug}
            lessonSlug={lessonSlug}
            userId={access.userId}
            isMember={access.isMember}
            isTeacher={access.isTeacher}
            isStudent={access.isStudent}
            submissionsUnavailable={submissionsUnavailable}
            submissions={subMap}
          />
        </section>
      )}

      {lesson.homework && lesson.homework.items.length > 0 && (
        <section className="lesson-section">
          <div className="lesson-section-head">
            <h2>Homework</h2>
            <span className="muted">due {formatDay(lesson.homework.due, { year: true })}</span>
            {access.userId && (
              <div className="lesson-hw-progress">
                <ProgressBar done={hwDone} total={hwRefs.length} label={`${hwDone}/${hwRefs.length} done`} />
              </div>
            )}
          </div>
          <RefList
            items={lesson.homework.items}
            done={done}
            classSlug={slug}
            lessonSlug={lessonSlug}
            userId={access.userId}
            isMember={access.isMember}
            isTeacher={access.isTeacher}
            isStudent={access.isStudent}
            submissionsUnavailable={submissionsUnavailable}
            submissions={subMap}
          />
        </section>
      )}
      {!access.isTeacher && (
        <ReportClassButton slug={slug} lesson={lessonSlug} signedIn={!!access.userId} />
      )}
    </article>
  );
}
