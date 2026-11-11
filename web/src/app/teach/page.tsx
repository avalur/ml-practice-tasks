import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { teacherState } from "@/lib/teachers";
import { formatDay } from "@/lib/classes";
import { teachingOverview, type TeachingClass } from "@/lib/teaching";
import { GradingList } from "@/components/GradingList";
import { Badge, EmptyState, Notice, PageHeader, ProgressBar, Section, Stat } from "@/components/ui";
import { TEACHER_TERMS, TEACHER_TERMS_VERSION } from "@/content/teacher-terms";
import { TeacherApplyForm } from "@/components/TeacherApplyForm";
import { AcceptTermsButton } from "@/components/AcceptTermsButton";

export const metadata: Metadata = { title: "Teach — ML Practice" };

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* The one page on the way to teaching. It shows whichever step the visitor is
 * on — sign in, apply, wait, accept the terms — and, once they are a teacher,
 * their classes. */
export default async function TeachPage() {
  const [state, admin] = await Promise.all([teacherState(), isSiteAdmin()]);
  // A teacher of a repo class (Class.teacherEmails) has classes to run whether
  // or not they ever applied for the Studio role, so they get the dashboard too;
  // the application steps then sit below it, as the way into the Studio.
  const overview = state.kind === "anonymous" ? null : await teachingOverview();
  const dashboard = state.kind === "active" || (overview?.classes.length ?? 0) > 0;

  return (
    <article className={dashboard ? "teach teach-wide" : "teach"}>
      <PageHeader
        title={dashboard ? "Teaching" : "Teach on ML Practice"}
        subtitle={
          dashboard
            ? "Your classes, what is waiting to be graded, and what is coming up."
            : "Teachers build their own courses here from the site’s tasks and their own slides, hand their students a group code, and follow their homework."
        }
        actions={
          state.kind === "active" ? (
            <Link className="btn primary small" href="/studio">
              New course
            </Link>
          ) : undefined
        }
      />

      {admin && <AdminSummary />}

      {dashboard && overview && (
        <TeacherHome
          overview={overview}
          since={state.kind === "active" ? state.since : null}
        />
      )}
      {dashboard && state.kind !== "active" && (
        <h2 className="teach-studio-title">Build your own courses in the Studio</h2>
      )}

      {state.kind === "anonymous" && (
        <p>
          <Link href="/signin?next=/teach">Sign in</Link> to apply. Applications are read by
          a person, usually within a few days.
        </p>
      )}

      {state.kind === "none" && (
        <>
          {state.rejected && (
            <Notice tone="neutral" testId="teach-rejected">
              Your last application ({dateFmt(state.rejected.at)}) was not approved.
              {state.rejected.note && (
                <>
                  {" "}
                  The reviewer wrote: <em>{state.rejected.note}</em>
                </>
              )}{" "}
              You are welcome to apply again.
            </Notice>
          )}
          <h2>Apply to teach</h2>
          <TeacherApplyForm />
        </>
      )}

      {state.kind === "pending" && (
        <Notice tone="info" testId="teach-pending">
          <Badge tone="info">pending</Badge> Your application from {dateFmt(state.since)} is
          waiting for review. You will get an email when it is answered.
        </Notice>
      )}

      {state.kind === "revoked" && (
        <>
          <Notice tone="danger" testId="teach-revoked">
            Your teacher access was withdrawn on {dateFmt(state.at)}. If you think that is a
            mistake, apply again and say so.
          </Notice>
          <h2>Apply again</h2>
          <TeacherApplyForm />
        </>
      )}

      {state.kind === "terms" && (
        <section data-testid="teach-terms">
          <h2>Teacher terms</h2>
          {state.previouslyAccepted && (
            <Notice tone="warning">
              The terms have changed since you last accepted them. Please read them again.
            </Notice>
          )}
          <ol className="teach-terms">
            {TEACHER_TERMS.map((t) => (
              <li key={t.title}>
                <strong>{t.title}.</strong> {t.body}
              </li>
            ))}
          </ol>
          <p className="muted">Version {TEACHER_TERMS_VERSION}.</p>
          <AcceptTermsButton version={TEACHER_TERMS_VERSION} />
        </section>
      )}

    </article>
  );
}

function TeacherHome({
  overview: { classes, grading, gradingUnavailable },
  since,
}: {
  overview: Awaited<ReturnType<typeof teachingOverview>>;
  since: Date | null;
}) {
  const students = classes.reduce((n, c) => n + c.students, 0);
  const upcoming = classes
    .filter((c) => c.nextLesson)
    .sort((a, b) => a.nextLesson!.date.localeCompare(b.nextLesson!.date))[0];

  return (
    <section data-testid={since ? "teach-active" : "teach-classes"}>
      <div className="stats">
        <Stat value={classes.length} label={classes.length === 1 ? "class" : "classes"} />
        <Stat value={students} label="students in groups" />
        <Stat
          value={grading.length}
          label="notebooks to grade"
          tone={grading.length > 0 ? "warning" : undefined}
          testId="stat-to-grade"
        />
        <Stat
          value={upcoming ? formatDay(upcoming.nextLesson!.date) : "—"}
          label={upcoming ? `next: ${upcoming.title}` : "no lesson scheduled"}
        />
      </div>

      <Section
        title="Your classes"
        action={
          since && (
            <Link href="/studio" data-testid="open-studio">
              Open the Studio
            </Link>
          )
        }
      >
        {classes.length === 0 ? (
          <EmptyState
            title="No classes yet"
            action={
              since && (
                <Link className="btn small primary" href="/studio">
                  Build a course in the Studio
                </Link>
              )
            }
          >
            A course is lessons, slides, tasks from the catalogue and homework. Your students
            join it with a group code you make.
          </EmptyState>
        ) : (
          <div className="teach-classes">
            {classes.map((c) => (
              <TeachingCard key={c.slug} c={c} />
            ))}
          </div>
        )}
      </Section>

      <Section title="To grade" testId="teach-grading">
        {gradingUnavailable ? (
          <Notice tone="warning">
            Notebook submissions are unavailable on this deployment (table not migrated).
          </Notice>
        ) : (
          <GradingList
            items={grading.slice(0, 12)}
            showClass
            empty="No notebook is waiting for a grade."
            testId="teach-grading-list"
          />
        )}
      </Section>

      {since && <p className="muted teach-since">Teacher since {dateFmt(since)}.</p>}
    </section>
  );
}

const STATUS_TONE = { published: "success", draft: "warning", suspended: "danger" } as const;

function TeachingCard({ c }: { c: TeachingClass }) {
  const base = `/classes/${c.slug}`;
  return (
    <div className="card teach-card" data-testid={`teach-class-${c.slug}`}>
      <div className="card-head">
        <Link className="card-title" href={base}>
          {c.title}
        </Link>
        <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
        {c.studio && <Badge tone="neutral">{c.listed ? "studio · listed" : "studio · unlisted"}</Badge>}
      </div>
      <div className="teach-card-facts">
        <span>
          <strong>{c.students}</strong> student{c.students === 1 ? "" : "s"}
        </span>
        <span>
          <strong>{c.lessonCount}</strong> lesson{c.lessonCount === 1 ? "" : "s"}
        </span>
        {c.toGrade > 0 && (
          <Link href={`${base}/homework?tab=grading`}>
            <Badge tone="warning">{c.toGrade} to grade</Badge>
          </Link>
        )}
      </div>
      {c.homework && (
        <ProgressBar
          done={c.homework.done}
          total={c.homework.total}
          label={`${Math.round((c.homework.done / c.homework.total) * 100)}% of due homework done`}
        />
      )}
      {c.nextLesson && (
        <p className="teach-card-next">
          Next: <Link href={`${base}/lessons/${c.nextLesson.slug}`}>{c.nextLesson.title}</Link>{" "}
          <span className="muted">· {formatDay(c.nextLesson.date)}</span>
        </p>
      )}
      <div className="teach-card-actions">
        <Link className="btn small" href={`${base}/homework?tab=homework`}>
          Homework
        </Link>
        <Link className="btn small" href={`${base}/homework?tab=attendance`}>
          Attendance
        </Link>
        <Link className="btn small" href={`${base}/homework?tab=groups`}>
          Group codes
        </Link>
        <Link className="btn subtle small" href={`${base}/monitor`}>
          Live monitor
        </Link>
        {c.studio && (
          <Link className="btn subtle small" href={`/studio/${c.slug}`}>
            Edit
          </Link>
        )}
      </div>
    </div>
  );
}

async function AdminSummary() {
  const [applications, reports, proposals] = await Promise.all([
    prisma.teacherApplication.count({ where: { status: "pending" } }),
    prisma.classReport.count({ where: { status: "open" } }),
    prisma.problemProposal.count({ where: { status: "pending" } }).catch(() => 0),
  ]);
  const waiting = applications + reports + proposals;
  return (
    <Notice tone={waiting > 0 ? "warning" : "neutral"} testId="admin-summary">
      <Badge tone="info">admin</Badge>{" "}
      {waiting > 0 ? (
        <>
          {applications} application{applications === 1 ? "" : "s"}, {reports} open report
          {reports === 1 ? "" : "s"} and {proposals} task proposal{proposals === 1 ? "" : "s"} are
          waiting.
        </>
      ) : (
        <>Nothing is waiting for review.</>
      )}{" "}
      <Link href="/admin">Open admin</Link>
    </Notice>
  );
}
