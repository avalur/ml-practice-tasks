import Link from "next/link";

import {
  contentHref,
  effectiveMaxScore,
  isAssignment,
  isGroup,
  isLink,
  type AssignmentRef,
  type ContentRef,
  type GroupRef,
  type Item,
  type LinkRef,
  type NotebookSubmissionData,
  type TrackableRef,
} from "@/lib/classes";
import { renderFeedbackMarkdown } from "@/lib/feedback-render";
import { NotebookUploader } from "@/components/NotebookUploader";

/* The items of a lesson — tasks, notebooks, whole topics, notebook assignments
 * and off-site links — as the lesson page lists them. A link is matched first,
 * always: flatten() drops links, so a completion check on one would be
 * [].every() and tick it as done. */

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
        <span className="badge tone-neutral">{content.type}</span>
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
          <span className="title lesson-assignment-title">
            {isCompleted ? "✓ " : ""}
            {assignment.title}
          </span>
        </div>
        <div className="notebook-card-badges">
          {assignment.maxScore && (
            <span className="muted notebook-card-points">{assignment.maxScore} pts</span>
          )}
          <span className="badge tone-info">assignment</span>
          {submissionsUnavailable ? (
            <span className="badge tone-neutral" data-testid="lesson-status-badge">
              Submissions Unavailable
            </span>
          ) : isGraded ? (
            <span className="badge tone-success" data-testid="lesson-grade-badge">
              Graded: {submission.grade}/{maxScore}
            </span>
          ) : submission ? (
            <span className="badge tone-warning" data-testid="lesson-status-badge">
              Submitted · Awaiting Review
            </span>
          ) : (
            <span className="badge tone-warning" data-testid="lesson-status-badge">
              Not Submitted
            </span>
          )}
        </div>
      </div>

      <div className="notebook-card-body">
        {assignment.templateHref && (
          <p className="notebook-card-template">
            <a
              href={assignment.templateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn subtle small"
              data-testid="template-link"
            >
              Open starter notebook (Colab) ↗
            </a>
          </p>
        )}

        {isTeacher ? (
          <div className="notebook-card-note muted" data-testid="teacher-assignment-notice">
            <span>Instructor view: </span>
            <Link
              href={`/classes/${classSlug}/homework?lesson=${lessonSlug}`}
              className="btn subtle small"
            >
              Review submissions in homework matrix →
            </Link>
          </div>
        ) : submissionsUnavailable ? (
          <div className="notebook-card-note muted" data-testid="submissions-unavailable-notice">
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
          <p className="notebook-card-note muted">
            Sign in to submit your solution notebook.
          </p>
        ) : (
          <p className="notebook-card-note muted">
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
          <span className={`badge ${complete ? "tone-success" : "tone-warning"}`}>
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
        <span className="badge tone-neutral">external</span>
      </span>
    </a>
  );
}

export function RefList({
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

