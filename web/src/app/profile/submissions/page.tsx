import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/classes";
import { profileUser } from "@/lib/student";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";

export const metadata = { title: "Submissions — ML Practice" };

const PAGE = 50;

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const user = await profileUser();
  if (!user) return null;
  const { view, page } = await searchParams;
  const all = view === "all";
  const pageNo = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const header = (
    <>
      <PageHeader title="Submissions" subtitle="Every run of the tests you sent to the site." />
      <Tabs
        label="Submission views"
        current={all ? "/profile/submissions?view=all" : "/profile/submissions"}
        items={[
          { href: "/profile/submissions", label: "By problem" },
          { href: "/profile/submissions?view=all", label: "All attempts" },
        ]}
      />
    </>
  );

  if (!all) {
    const rows = await prisma.userProblemProgress.findMany({
      where: { userId: user.id, attemptCount: { gt: 0 } },
      orderBy: { lastSubmittedAt: "desc" },
      select: {
        clientSolved: true,
        attemptCount: true,
        bestPassed: true,
        bestTotal: true,
        lastSubmittedAt: true,
        bestSubmissionId: true,
        problem: { select: { title: true, topic: true, slug: true } },
      },
    });
    return (
      <>
        {header}
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <ul className="rows card" data-testid="submissions-by-problem">
            {rows.map((r) => {
              const href = `/problems/${r.problem.topic}/${r.problem.slug}${
                r.bestSubmissionId ? `?submission=${r.bestSubmissionId}` : ""
              }`;
              return (
                <li key={`${r.problem.topic}/${r.problem.slug}`}>
                  <div className="row-main">
                    <Link className="row-title" href={href}>
                      {r.problem.title}
                    </Link>
                    <div className="row-sub">
                      {r.problem.topic} · {r.attemptCount} attempt{r.attemptCount === 1 ? "" : "s"}
                      {r.lastSubmittedAt ? ` · last ${formatDate(r.lastSubmittedAt)}` : ""}
                    </div>
                  </div>
                  {r.clientSolved ? (
                    <Badge tone="success">solved</Badge>
                  ) : (
                    <Badge tone="warning">
                      best {r.bestPassed}/{r.bestTotal}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  const [submissions, count] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (pageNo - 1) * PAGE,
      take: PAGE,
      include: { problem: { select: { title: true, topic: true, slug: true } } },
    }),
    prisma.submission.count({ where: { userId: user.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <>
      {header}
      {submissions.length === 0 ? (
        <Empty />
      ) : (
        <ul className="rows card" data-testid="submissions-all">
          {submissions.map((s) => {
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
                  <div className="row-sub">
                    {s.problem.topic} · {formatDate(s.createdAt)}
                  </div>
                </div>
                <Badge tone={ok ? "success" : "danger"}>
                  {s.passed}/{s.total}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {pageNo > 1 && (
            <Link className="btn small" href={`/profile/submissions?view=all&page=${pageNo - 1}`}>
              ← Newer
            </Link>
          )}
          <span className="muted">
            Page {pageNo} of {pages}
          </span>
          {pageNo < pages && (
            <Link className="btn small" href={`/profile/submissions?view=all&page=${pageNo + 1}`}>
              Older →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function Empty() {
  return (
    <EmptyState
      title="No submissions yet"
      action={
        <Link className="btn small primary" href="/problems">
          Go solve something
        </Link>
      }
    >
      Run the tests on any problem while signed in and it shows up here.
    </EmptyState>
  );
}
