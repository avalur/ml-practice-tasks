import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  contentHref,
  findLesson,
  flatten,
  getAccess,
  getClassMeta,
  isAssignment,
  isDone,
  isGroup,
  isLink,
  solvedKeys,
  type AssignmentRef,
  type ContentRef,
  type GroupRef,
  type Item,
  type LinkRef,
  type TrackableRef,
  type SolvedKeysResult,
} from "@/lib/classes";
import { PresentButton } from "@/components/PresentButton";
import { NotebookUploader } from "@/components/NotebookUploader";
import { renderFeedbackMarkdown } from "@/lib/feedback-render";
import {
  effectiveMaxScore,
  type NotebookSubmissionData,
} from "@/lib/classes-shared";

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

// `content`, not `ref`: React reserves a prop called `ref`, and a server
// component that takes one fails to serialise at render time.
function RefRow({
  content,
  done,
}: {
  content: ContentRef;
  done: (r: TrackableRef) => boolean;
}) {
  return (
    <Link href={contentHref(content)} className="problem-card">
      <span className="title">
        {done(content) ? "✓ " : ""}
        {content.id}
      </span>
      <span className="meta">
        <span className="badge medium">{content.type}</span>
      </span>
    </Link>
  );
}

function AssignmentCard({
  assignment,
  done,
  classSlug,
  lessonSlug,
  userId,
  isMember,
  isTeacher,
  isStudent,
  submissionsUnavailable,
  submission,
}: {
  assignment: AssignmentRef;
  done: (r: TrackableRef) => boolean;
  classSlug: string;
  lessonSlug: string;
  userId?: string | null;
  isMember: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  submissionsUnavailable: boolean;
  submission: NotebookSubmissionData | null;
}) {
  const isCompleted = done(assignment) || submission !== null;
  const isGraded = submission?.status === "graded" && submission.grade !== null;
  const renderedFeedback = submission?.feedback
    ? renderFeedbackMarkdown(submission.feedback)
    : null;
  const maxScore = effectiveMaxScore(assignment.maxScore, submission?.maxGrade);

  return (
    <div
      className="notebook-assignment-card lesson-assignment-card"
      data-testid={`assignment-${assignment.id}`}
    >
      <div className="notebook-card-header">
        <div>
          <span className="title" style={{ fontSize: "1.05rem", fontWeight: 600 }}>
            {isCompleted ? "✓ " : ""}
            {assignment.title}
          </span>
        </div>
        <div className="notebook-card-badges">
          {assignment.maxScore && (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {assignment.maxScore} pts ·{" "}
            </span>
          )}
          <span className="badge medium">assignment</span>
          {submissionsUnavailable ? (
            <span className="badge muted" data-testid="lesson-status-badge">
              Submissions Unavailable
            </span>
          ) : isGraded ? (
            <span className="badge easy" data-testid="lesson-grade-badge">
              Graded: {submission.grade}/{maxScore}
            </span>
          ) : submission ? (
            <span className="badge medium" data-testid="lesson-status-badge">
              Submitted · Awaiting Review
            </span>
          ) : (
            <span className="badge hw-sub-none" data-testid="lesson-status-badge">
              Not Submitted
            </span>
          )}
        </div>
      </div>

      <div className="notebook-card-body">
        {assignment.templateHref && (
          <div style={{ marginBottom: "0.5rem" }}>
            <a
              href={assignment.templateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="bt-clear-btn"
              style={{ fontSize: "0.82rem" }}
              data-testid="template-link"
            >
              Open starter notebook (Colab) ↗
            </a>
          </div>
        )}

        {isTeacher ? (
          <div
            className="notebook-teacher-notice muted"
            style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}
            data-testid="teacher-assignment-notice"
          >
            <span>Instructor view: </span>
            <Link
              href={`/classes/${classSlug}/homework?lesson=${lessonSlug}`}
              className="bt-clear-btn"
              style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}
            >
              Review submissions in homework matrix →
            </Link>
          </div>
        ) : submissionsUnavailable ? (
          <div
            className="notebook-notice muted"
            style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}
            data-testid="submissions-unavailable-notice"
          >
            Notebook submissions are currently unavailable on this deployment.
          </div>
        ) : isStudent && userId ? (
          <NotebookUploader
            classSlug={classSlug}
            lessonSlug={lessonSlug}
            assignmentId={assignment.id}
            userId={userId}
            initialSubmission={submission}
            maxScore={assignment.maxScore}
            renderedFeedbackHtml={renderedFeedback}
            submissionsUnavailable={submissionsUnavailable}
          />
        ) : !userId ? (
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            Sign in to submit your solution notebook.
          </p>
        ) : (
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            Join this class with your teacher&rsquo;s group code to submit homework.
          </p>
        )}
      </div>
    </div>
  );
}

/* A whole topic assigned at once stays one row until you open it: a 26-task
   homework should read as "4/26 done", not as a wall of links. */
function GroupCard({ group, done }: { group: GroupRef; done: (r: TrackableRef) => boolean }) {
  const n = group.items.filter(done).length;
  const total = group.items.length;
  const complete = n === total;
  // Always folded: the whole point of assigning a topic is that its tasks stay
  // one line until the student asks for them.
  return (
    <details className="ref-group">
      <summary>
        <span className="title">
          {complete ? "✓ " : ""}
          {group.title}
        </span>
        <span className="meta">
          <span className={`badge ${complete ? "easy" : "medium"}`}>
            {n}/{total} done
          </span>
          <code className="topic-tag">{group.pattern}</code>
        </span>
      </summary>
      <ul className="problem-list">
        {group.items.map((content) => (
          <li key={`${content.type}:${content.id}`}>
            <RefRow content={content} done={done} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/* Work that lives off-site: it opens in a new tab and is never ticked off. */
function LinkRow({ link }: { link: LinkRef }) {
  return (
    <a href={link.href} className="problem-card" target="_blank" rel="noopener noreferrer">
      <span className="title">{link.title}</span>
      <span className="meta">
        <span className="badge medium">external</span>
      </span>
    </a>
  );
}

function RefList({
  items,
  done,
  classSlug,
  lessonSlug,
  userId,
  isMember,
  isTeacher,
  isStudent,
  submissionsUnavailable,
  submissions,
}: {
  items: Item[];
  done: (r: TrackableRef) => boolean;
  classSlug: string;
  lessonSlug: string;
  userId?: string | null;
  isMember: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  submissionsUnavailable: boolean;
  submissions?: Map<string, NotebookSubmissionData>;
}) {
  return (
    <ul className="problem-list">
      {items.map((item) =>
        isLink(item) ? (
          <li key={`link:${item.href}`}>
            <LinkRow link={item} />
          </li>
        ) : isGroup(item) ? (
          <li key={`group:${item.pattern}`}>
            <GroupCard group={item} done={done} />
          </li>
        ) : isAssignment(item) ? (
          <li key={`assignment:${item.id}`}>
            <AssignmentCard
              assignment={item}
              done={done}
              classSlug={classSlug}
              lessonSlug={lessonSlug}
              userId={userId}
              isMember={isMember}
              isTeacher={isTeacher}
              isStudent={isStudent}
              submissionsUnavailable={submissionsUnavailable}
              submission={submissions?.get(item.id) ?? null}
            />
          </li>
        ) : (
          <li key={`${item.type}:${item.id}`}>
            <RefRow content={item} done={done} />
          </li>
        ),
      )}
    </ul>
  );
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

  let submissionsUnavailable = false;
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
      ? prisma.notebookSubmission
          .findMany({
            where: {
              userId: access.userId,
              classId,
              lessonSlug,
            },
          })
          .catch((err) => {
            if (err?.code === "P2021") {
              submissionsUnavailable = true;
              return [];
            }
            throw err;
          })
      : Promise.resolve([]),
  ]);

  if ((solved as SolvedKeysResult).unavailable) {
    submissionsUnavailable = true;
  }

  const subMap = new Map<string, NotebookSubmissionData>();
  for (const s of userSubmissions) {
    subMap.set(s.assignmentId, {
      id: s.id,
      userId: s.userId,
      classId: s.classId,
      lessonSlug: s.lessonSlug,
      assignmentId: s.assignmentId,
      fileUrl: s.fileUrl,
      fileName: s.fileName,
      fileBytes: s.fileBytes,
      submittedAt: s.submittedAt.toISOString(),
      status: s.status,
      grade: s.grade,
      maxGrade: s.maxGrade,
      feedback: s.feedback,
      gradedBy: s.gradedBy,
      gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    });
  }

  const done = (r: TrackableRef) =>
    !!access.userId &&
    isDone(solved, access.userId, r, {
      classId,
      lessonSlug,
    });
  const hwRefs = flatten(lesson.homework?.items ?? []);
  const slidesUrl = `/classes/${slug}/${lessonSlug}/present.html`;
  const due = lesson.homework ? new Date(lesson.homework.due) : null;

  return (
    <article>
      <p className="muted class-breadcrumb">
        <Link href="/classes">Classes</Link> ›{" "}
        <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <h1>{lesson.title}</h1>
      {lesson.date && <p className="muted">{lesson.date}</p>}

      <div className="class-lesson-actions">
        <a className="bt-clear-btn" href={slidesUrl} target="_blank" rel="noopener">
          Open slides
        </a>
        {access.isTeacher && <PresentButton classSlug={slug} lessonSlug={lessonSlug} />}
        {access.isTeacher && (
          <Link
            className="bt-clear-btn"
            href={`/classes/${slug}/homework?lesson=${lessonSlug}`}
          >
            Attendance
          </Link>
        )}
        {attendance?.attended && (
          <span className="badge easy" style={{ alignSelf: "center" }}>
            ✓ Attended
          </span>
        )}
        {/* "Finish lesson" saves the annotated PDF to the teacher's machine and
            uploads a copy to Blob storage; this appears once that copy lands.
            The store is private, so the link goes through our own route, which
            checks membership and signs a short-lived download URL. */}
        {delivered?.pdfUrl && access.isMember && (
          <a
            className="bt-clear-btn"
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
          ? `Delivered ${delivered.endedAt.toLocaleDateString()}` +
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
        <section style={{ marginTop: "2rem" }}>
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
        <section style={{ marginTop: "2rem" }}>
          <h2>Homework</h2>
          <p className="muted">
            Due {due && !Number.isNaN(due.getTime()) ? due.toLocaleString() : lesson.homework.due}
            {" · "}
            {hwRefs.filter(done).length}/{hwRefs.length} done
          </p>
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
    </article>
  );
}
