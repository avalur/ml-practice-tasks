import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { REPORT_REASONS, type ReportReason } from "@/lib/teachers";
import { AdminAction } from "@/components/AdminAction";
import { SuspendToggle } from "@/components/SuspendToggle";

const when = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* Open reports, grouped by class so that five complaints about one course read
 * as one decision, with the suspend switch right next to them. Closing a report
 * never touches the class; suspending is always a separate click. */
export default async function AdminReportsPage() {
  if (!(await isSiteAdmin())) notFound();

  const [open, closed, suspended] = await Promise.all([
    prisma.classReport.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      include: {
        class: { select: { slug: true, title: true, suspendedAt: true, teacherEmails: true } },
        reporter: { select: { name: true, email: true } },
      },
    }),
    prisma.classReport.findMany({
      where: { status: { not: "open" } },
      orderBy: { resolvedAt: "desc" },
      take: 20,
      include: { class: { select: { slug: true, title: true } } },
    }),
    prisma.class.findMany({
      where: { suspendedAt: { not: null } },
      select: { slug: true, title: true, suspendedAt: true, suspendedReason: true, suspendedBy: true },
    }),
  ]);

  const byClass = new Map<string, typeof open>();
  for (const r of open) byClass.set(r.class.slug, [...(byClass.get(r.class.slug) ?? []), r]);

  return (
    <article>
      <h1>Reports</h1>

      <section data-testid="open-reports">
        <h2>Open ({open.length})</h2>
        {open.length === 0 && <p className="muted">Nothing reported.</p>}
        {[...byClass.entries()].map(([slug, reports]) => {
          const cls = reports[0].class;
          return (
            <div key={slug} className="admin-card" data-testid={`reports-${slug}`}>
              <div className="admin-actions">
                <Link href={`/classes/${slug}`}>
                  <strong>{cls.title}</strong>
                </Link>
                <span className="muted">teachers: {cls.teacherEmails.join(", ") || "—"}</span>
                <SuspendToggle slug={slug} suspended={!!cls.suspendedAt} />
              </div>
              <ul className="admin-list">
                {reports.map((r) => (
                  <li key={r.id}>
                    <p>
                      <span className="badge tone-danger">
                        {REPORT_REASONS[r.reason as ReportReason] ?? r.reason}
                      </span>{" "}
                      <span className="muted">
                        {when(r.createdAt)} · {r.reporter.name ?? r.reporter.email} ({r.reporter.email})
                        {r.lessonSlug && (
                          <>
                            {" · "}
                            <Link href={`/classes/${slug}/lessons/${r.lessonSlug}`}>{r.lessonSlug}</Link>
                          </>
                        )}
                      </span>
                    </p>
                    <p className="admin-quote">{r.details}</p>
                    <div className="admin-actions">
                      <AdminAction
                        url={`/api/admin/reports/${r.id}`}
                        body={{ status: "resolved" }}
                        label="Resolved"
                        testId="resolve"
                      />
                      <AdminAction
                        url={`/api/admin/reports/${r.id}`}
                        body={{ status: "dismissed" }}
                        label="Dismiss"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {suspended.length > 0 && (
        <section>
          <h2>Suspended classes</h2>
          <ul className="admin-list compact">
            {suspended.map((c) => (
              <li key={c.slug}>
                <Link href={`/classes/${c.slug}`}>{c.title}</Link>{" "}
                <span className="muted">
                  {c.suspendedAt && when(c.suspendedAt)} by {c.suspendedBy} · “{c.suspendedReason}”
                </span>{" "}
                <SuspendToggle slug={c.slug} suspended />
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <h2>Recently closed</h2>
          <ul className="admin-list compact">
            {closed.map((r) => (
              <li key={r.id}>
                <span className="badge">{r.status}</span>{" "}
                <Link href={`/classes/${r.class.slug}`}>{r.class.title}</Link>{" "}
                <span className="muted">
                  {REPORT_REASONS[r.reason as ReportReason] ?? r.reason}
                  {r.resolvedAt && ` · ${when(r.resolvedAt)} by ${r.resolvedBy}`}
                </span>{" "}
                <AdminAction url={`/api/admin/reports/${r.id}`} body={{ status: "open" }} label="Reopen" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
