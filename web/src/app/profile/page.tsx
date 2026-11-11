import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/classes";
import { computeStreak } from "@/lib/stats";
import { firstNameOf } from "@/lib/person";
import {
  FAMILY_LABEL,
  dueTone,
  profileUser,
  studentAssignments,
  studentHomework,
  trackProgress,
} from "@/lib/student";
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  ProgressBar,
  Section,
  Stat,
} from "@/components/ui";
import { DueBadge } from "./DueBadge";

export const metadata = { title: "Dashboard — ML Practice" };

/* `/profile?tab=…` was the cabinet before it had routes. Links to it live in old
 * emails and bookmarks, so each tab still lands on its page. */
const LEGACY_TABS: Record<string, string> = {
  submissions: "/profile/submissions",
  favorites: "/profile/favorites",
  notebooks: "/profile/assignments",
  classes: "/profile/classes",
  account: "/profile/account",
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  const { tab, saved } = await searchParams;
  if (tab && LEGACY_TABS[tab]) {
    redirect(`${LEGACY_TABS[tab]}${tab === "account" && saved ? `?saved=${saved}` : ""}`);
  }

  const user = await profileUser();
  if (!user) return null;

  const [tracks, streak, homework, assignments, attempted, recent] = await Promise.all([
    trackProgress(user.id),
    computeStreak(user.id),
    studentHomework(user.id),
    studentAssignments(user.id),
    // Started and not finished: the obvious thing to come back to.
    prisma.userProblemProgress.findMany({
      where: { userId: user.id, clientSolved: false, attemptCount: { gt: 0 } },
      orderBy: { lastSubmittedAt: "desc" },
      take: 4,
      select: {
        bestPassed: true,
        bestTotal: true,
        lastSubmittedAt: true,
        problem: { select: { title: true, topic: true, slug: true } },
      },
    }),
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        passed: true,
        total: true,
        createdAt: true,
        problem: { select: { title: true, topic: true, slug: true } },
      },
    }),
  ]);

  const open = homework.entries.filter((e) => e.done < e.total);
  const overdue = open.filter((e) => e.overdue).length;
  const graded = assignments.items
    .filter((a) => a.submission?.status === "graded" && a.submission.grade !== null)
    .sort((a, b) => (b.submission!.gradedAt ?? "").localeCompare(a.submission!.gradedAt ?? ""));
  const awaiting = assignments.items.filter(
    (a) => a.submission && a.submission.status !== "graded",
  ).length;
  const first = firstNameOf(user.name);
  const unavailable = homework.unavailable || assignments.unavailable;

  return (
    <>
      <PageHeader
        title={first ? `Welcome back, ${first}` : "Your dashboard"}
        subtitle="What is due, what you have solved, and what your teachers said."
      />
      {unavailable && (
        <Notice tone="warning" testId="submissions-unavailable-notice">
          Notebook submissions are unavailable on this deployment, so notebook assignments are
          left out of the homework counts and grades below.
        </Notice>
      )}

      <div className="stats" data-testid="overview-stats">
        <Stat
          value={`${tracks.solved}/${tracks.total}`}
          label="problems solved"
          href="/problems"
        />
        <Stat value={streak} label={streak === 1 ? "day streak" : "days streak"} />
        <Stat
          value={open.length}
          label={overdue ? `homework open · ${overdue} overdue` : "homework open"}
          tone={overdue ? "danger" : open.length ? "warning" : undefined}
          testId="stat-homework-open"
        />
        <Stat
          value={awaiting}
          label="notebooks awaiting review"
          href="/profile/assignments?status=submitted"
        />
      </div>

      <div className="grid-2">
        <Section
          title="Up next"
          action={homework.classes.length > 0 && <Link href="/profile/classes">All classes</Link>}
          testId="overview-up-next"
        >
          {homework.classes.length === 0 ? (
            <EmptyState
              title="You are not in a class yet"
              action={
                <Link className="btn small" href="/profile/classes">
                  Join with a group code
                </Link>
              }
            >
              Classes are open to read; a group code from your teacher makes your homework
              count.
            </EmptyState>
          ) : open.length === 0 ? (
            <EmptyState title="All caught up">Every homework in your classes is done.</EmptyState>
          ) : (
            <ul className="rows card">
              {open.slice(0, 6).map((e) => (
                <li key={`${e.classSlug}/${e.lessonSlug}`}>
                  <div className="row-main">
                    <Link
                      className="row-title"
                      href={`/classes/${e.classSlug}/lessons/${e.lessonSlug}`}
                    >
                      {e.lessonTitle}
                    </Link>
                    <div className="row-sub">{e.classTitle}</div>
                  </div>
                  <div className="row-meta">
                    <ProgressBar done={e.done} total={e.total} />
                    <DueBadge entry={e} tone={dueTone(e)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Progress by track" action={<Link href="/problems">Problems</Link>}>
          <div className="card">
            <ul className="rows">
              {tracks.families.map((f) => (
                <li key={f.family}>
                  <span className="row-main row-title">{FAMILY_LABEL[f.family] ?? f.family}</span>
                  <div className="track-bar">
                    <ProgressBar done={f.solved} total={f.total} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Continue solving">
          {attempted.length === 0 ? (
            <EmptyState
              title="Nothing in progress"
              action={
                <Link className="btn small primary" href="/problems">
                  Pick a problem
                </Link>
              }
            >
              Problems you have tried but not passed yet show up here.
            </EmptyState>
          ) : (
            <ul className="rows card">
              {attempted.map((p) => (
                <li key={`${p.problem.topic}/${p.problem.slug}`}>
                  <div className="row-main">
                    <Link
                      className="row-title"
                      href={`/problems/${p.problem.topic}/${p.problem.slug}`}
                    >
                      {p.problem.title}
                    </Link>
                    <div className="row-sub">{p.problem.topic}</div>
                  </div>
                  <span className="row-meta muted">
                    best {p.bestPassed}/{p.bestTotal}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Teacher feedback"
          action={assignments.items.length > 0 && <Link href="/profile/assignments">Assignments</Link>}
        >
          {graded.length === 0 ? (
            <EmptyState title="No grades yet">
              Graded notebooks and your teacher&rsquo;s comments will appear here.
            </EmptyState>
          ) : (
            <ul className="rows card">
              {graded.slice(0, 4).map((a) => (
                <li key={`${a.classSlug}/${a.lessonSlug}/${a.assignment.id}`}>
                  <div className="row-main">
                    <Link
                      className="row-title"
                      href={`/profile/assignments#${a.classSlug}-${a.lessonSlug}-${a.assignment.id}`}
                    >
                      {a.assignment.title}
                    </Link>
                    <div className="row-sub">
                      {a.classTitle} · graded {formatDate(a.submission!.gradedAt)}
                    </div>
                  </div>
                  <Badge tone="success">
                    {a.submission!.grade}/{a.submission!.maxGrade ?? a.assignment.maxScore ?? 100}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {recent.length > 0 && (
        <Section
          title="Recent submissions"
          action={<Link href="/profile/submissions">All submissions</Link>}
        >
          <ul className="rows card">
            {recent.map((s) => {
              const ok = s.total > 0 && s.passed === s.total;
              return (
                <li key={s.id}>
                  <div className="row-main">
                    <Link
                      className="row-title"
                      href={`/problems/${s.problem.topic}/${s.problem.slug}?submission=${s.id}`}
                    >
                      {s.problem.title}
                    </Link>
                    <div className="row-sub">{formatDate(s.createdAt)}</div>
                  </div>
                  <Badge tone={ok ? "success" : "danger"}>
                    {s.passed}/{s.total}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}
