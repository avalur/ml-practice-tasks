import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { teacherState } from "@/lib/teachers";
import { getClasses, myClassSlugs } from "@/lib/classes";
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

  return (
    <article className="teach">
      <h1>Teach on ML Practice</h1>
      <p className="muted">
        Teachers build their own courses here from the site&rsquo;s tasks and their own
        slides, hand their students a group code, and follow their homework.
      </p>

      {admin && <AdminSummary />}

      {state.kind === "anonymous" && (
        <p>
          <Link href="/signin?next=/teach">Sign in</Link> to apply. Applications are read by
          a person, usually within a few days.
        </p>
      )}

      {state.kind === "none" && (
        <>
          {state.rejected && (
            <p className="class-draft-note" data-testid="teach-rejected">
              Your last application ({dateFmt(state.rejected.at)}) was not approved.
              {state.rejected.note && (
                <>
                  {" "}
                  The reviewer wrote: <em>{state.rejected.note}</em>
                </>
              )}{" "}
              You are welcome to apply again.
            </p>
          )}
          <h2>Apply to teach</h2>
          <TeacherApplyForm />
        </>
      )}

      {state.kind === "pending" && (
        <p className="class-draft-note" data-testid="teach-pending">
          <span className="badge medium">pending</span> Your application from{" "}
          {dateFmt(state.since)} is waiting for review. You will get an email when it is
          answered.
        </p>
      )}

      {state.kind === "revoked" && (
        <>
          <p className="class-draft-note" data-testid="teach-revoked">
            Your teacher access was withdrawn on {dateFmt(state.at)}. If you think that is a
            mistake, apply again and say so.
          </p>
          <h2>Apply again</h2>
          <TeacherApplyForm />
        </>
      )}

      {state.kind === "terms" && (
        <section data-testid="teach-terms">
          <h2>Teacher terms</h2>
          {state.previouslyAccepted && (
            <p className="class-draft-note">
              The terms have changed since you last accepted them. Please read them again.
            </p>
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

      {state.kind === "active" && <TeacherHome since={state.since} />}
    </article>
  );
}

async function TeacherHome({ since }: { since: Date }) {
  const [{ teaching }, all] = await Promise.all([myClassSlugs(), getClasses()]);
  const titles = new Map(all.map((c) => [c.slug, c.title]));
  return (
    <section data-testid="teach-active">
      <p>
        <span className="badge easy">teacher</span> since {dateFmt(since)}.
      </p>
      <h2>Your classes</h2>
      {teaching.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul>
          {teaching.map((slug) => (
            <li key={slug}>
              <Link href={`/classes/${slug}`}>{titles.get(slug) ?? slug}</Link>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="class-present-btn" href="/studio" data-testid="open-studio">
          Open the Studio
        </Link>{" "}
        <span className="muted">— build a course, write its slides, pick its tasks.</span>
      </p>
    </section>
  );
}

async function AdminSummary() {
  const [applications, reports, proposals] = await Promise.all([
    prisma.teacherApplication.count({ where: { status: "pending" } }),
    prisma.classReport.count({ where: { status: "open" } }),
    prisma.problemProposal.count({ where: { status: "pending" } }).catch(() => 0),
  ]);
  return (
    <div className="class-teacher-bar class-admin-bar" data-testid="admin-summary">
      <span className="badge medium">admin</span>
      <Link href="/admin/teachers">
        Teachers{applications > 0 ? ` · ${applications} to review` : ""}
      </Link>
      <Link href="/admin/reports">Reports{reports > 0 ? ` · ${reports} open` : ""}</Link>
      <Link href="/admin/proposals">Task proposals{proposals > 0 ? ` · ${proposals} to review` : ""}</Link>
    </div>
  );
}
