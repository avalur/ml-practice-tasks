import Link from "next/link";

import { effectiveMaxScore, formatDay, myClassSlugs } from "@/lib/classes";
import { renderFeedbackMarkdown } from "@/lib/feedback-render";
import {
  assignmentState,
  dueMs,
  isOverdue,
  profileUser,
  studentAssignments,
  type AssignmentState,
  type AssignmentWithSubmission,
} from "@/lib/student";
import { JoinClassForm } from "@/components/JoinClassForm";
import { NotebookUploader } from "@/components/NotebookUploader";
import { Badge, EmptyState, Notice, PageHeader, Tabs } from "@/components/ui";

export const metadata = { title: "Assignments — ML Practice" };

const FILTERS: Array<{ key: AssignmentState | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "submitted", label: "Awaiting review" },
  { key: "graded", label: "Graded" },
];

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await profileUser();
  if (!user) return null;
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.key === status) ? (status as AssignmentState) : "all";

  const [{ items, unavailable }, mine] = await Promise.all([
    studentAssignments(user.id),
    myClassSlugs(),
  ]);

  const header = (
    <PageHeader
      title="Assignments"
      subtitle="Notebook assignments from your classes: hand them in, see your grade and your teacher's feedback."
    />
  );

  if (items.length === 0) {
    const teaching = mine.teaching;
    const enrolled = mine.member.some((s) => !teaching.includes(s));
    return (
      <>
        {header}
        {enrolled ? (
          <EmptyState title="No notebook assignments yet">
            Your classes have not handed out any notebooks so far.
          </EmptyState>
        ) : teaching.length > 0 ? (
          <EmptyState
            title="Nothing to hand in"
            action={
              <Link className="btn small" href="/teach">
                Open your teaching dashboard
              </Link>
            }
          >
            You teach {teaching.length} class{teaching.length > 1 ? "es" : ""}; student
            submissions are reviewed from the teaching dashboard.
          </EmptyState>
        ) : (
          <>
            <EmptyState title="Not enrolled in any classes yet">
              Join a class with your teacher&rsquo;s group code to submit notebooks and receive
              grades.
            </EmptyState>
            <JoinClassForm />
          </>
        )}
      </>
    );
  }

  const counts = { all: items.length, todo: 0, submitted: 0, graded: 0 };
  for (const a of items) counts[assignmentState(a)] += 1;
  const shown = filter === "all" ? items : items.filter((a) => assignmentState(a) === filter);

  // Grouped by class, in course order (the order studentAssignments returns).
  const groups = new Map<string, { title: string; slug: string; items: AssignmentWithSubmission[] }>();
  for (const a of shown) {
    const g = groups.get(a.classSlug) ?? { title: a.classTitle, slug: a.classSlug, items: [] };
    g.items.push(a);
    groups.set(a.classSlug, g);
  }

  return (
    <>
      {header}
      {unavailable && (
        <Notice tone="warning" testId="submissions-unavailable-notice">
          Notebook submissions are currently unavailable on this deployment.
        </Notice>
      )}
      <Tabs
        label="Filter assignments"
        current={filter === "all" ? "/profile/assignments" : `/profile/assignments?status=${filter}`}
        items={FILTERS.map((f) => ({
          href: f.key === "all" ? "/profile/assignments" : `/profile/assignments?status=${f.key}`,
          label: f.label,
          count: counts[f.key],
          countTone: f.key === "todo" && counts.todo > 0 ? "warning" : undefined,
        }))}
      />

      {shown.length === 0 ? (
        <EmptyState title="Nothing here">No assignments match this filter.</EmptyState>
      ) : (
        <div className="notebook-assignment-list" data-testid="notebook-assignment-list">
          {[...groups.values()].map((g) => (
            <section key={g.slug} className="assignment-group">
              <h2 className="assignment-group-title">
                <Link href={`/classes/${g.slug}`}>{g.title}</Link>
              </h2>
              {g.items.map((a) => (
                <AssignmentCard key={`${a.lessonSlug}:${a.assignment.id}`} a={a} userId={user.id} unavailable={unavailable} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function AssignmentCard({
  a,
  userId,
  unavailable,
}: {
  a: AssignmentWithSubmission;
  userId: string;
  unavailable: boolean;
}) {
  const sub = a.submission;
  const maxScore = effectiveMaxScore(a.assignment.maxScore, sub?.maxGrade);
  const state = assignmentState(a);
  const late = state === "todo" && a.isHomework && isOverdue(dueMs(a.due));

  return (
    <div
      id={`${a.classSlug}-${a.lessonSlug}-${a.assignment.id}`}
      className="notebook-assignment-card"
      data-testid={`assignment-card-${a.assignment.id}`}
    >
      <div className="notebook-card-header">
        <div>
          <Link
            href={`/classes/${a.classSlug}/lessons/${a.lessonSlug}`}
            className="muted notebook-card-lesson-link"
          >
            {a.lessonTitle}
          </Link>
          <h3 className="notebook-card-title">{a.assignment.title}</h3>
          <div className="notebook-card-sub">
            {a.isHomework ? "Homework" : "In-class practice"}
            {a.assignment.maxScore ? ` · ${a.assignment.maxScore} pts` : ""}
            {a.isHomework && a.due ? ` · due ${formatDay(a.due, { year: true })}` : ""}
          </div>
        </div>
        <div className="notebook-card-badges">
          {unavailable ? (
            <Badge tone="neutral" testId="card-status-badge">
              Submissions unavailable
            </Badge>
          ) : state === "graded" ? (
            <Badge tone="success" testId="card-grade-badge">
              Graded: {sub!.grade}/{maxScore}
            </Badge>
          ) : state === "submitted" ? (
            <Badge tone="info" testId="card-status-badge">
              Submitted · awaiting review
            </Badge>
          ) : (
            <Badge tone={late ? "danger" : "warning"} testId="card-status-badge">
              {late ? "Overdue" : "Not submitted"}
            </Badge>
          )}
        </div>
      </div>

      <div className="notebook-card-body">
        {a.assignment.templateHref && (
          <p className="notebook-card-template">
            <a
              href={a.assignment.templateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn subtle small"
              data-testid="template-link"
            >
              Open starter notebook (Colab) ↗
            </a>
          </p>
        )}

        {unavailable ? (
          <p className="muted">Notebook submissions are currently unavailable on this deployment.</p>
        ) : (
          <NotebookUploader
            classSlug={a.classSlug}
            lessonSlug={a.lessonSlug}
            assignmentId={a.assignment.id}
            userId={userId}
            initialSubmission={sub}
            maxScore={a.assignment.maxScore}
            renderedFeedbackHtml={sub?.feedback ? renderFeedbackMarkdown(sub.feedback) : null}
            submissionsUnavailable={unavailable}
          />
        )}
      </div>
    </div>
  );
}
