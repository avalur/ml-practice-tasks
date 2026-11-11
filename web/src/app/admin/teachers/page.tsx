import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { TEACHER_TERMS_VERSION } from "@/content/teacher-terms";
import { AdminAction } from "@/components/AdminAction";
import { GrantTeacherForm } from "@/components/GrantTeacherForm";

const when = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* Applications waiting for an answer, then everybody who holds (or held) the
 * role, then the last few decisions — in the order an admin works through them. */
export default async function AdminTeachersPage() {
  if (!(await isSiteAdmin())) notFound();

  const [pending, grants, decided] = await Promise.all([
    prisma.teacherApplication.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true, createdAt: true } } },
    }),
    prisma.teacherGrant.findMany({ orderBy: [{ revokedAt: "asc" }, { grantedAt: "desc" }] }),
    prisma.teacherApplication.findMany({
      where: { status: { not: "pending" } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <article>
      <h1>Teachers</h1>

      <section data-testid="pending-applications">
        <h2>Applications to review ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">Nothing waiting.</p>}
        <ul className="admin-list">
          {pending.map((a) => (
            <li key={a.id} className="admin-card" data-testid={`application-${a.user.email}`}>
              <p>
                <strong>{a.user.name ?? a.user.email}</strong>{" "}
                <span className="muted">
                  {a.user.email} · applied {when(a.createdAt)} · account since{" "}
                  {when(a.user.createdAt)}
                </span>
              </p>
              <p className="admin-quote">{a.about}</p>
              <p className="admin-quote">{a.plans}</p>
              {a.link && (
                <p>
                  <a href={a.link} target="_blank" rel="noopener noreferrer nofollow">
                    {a.link}
                  </a>
                </p>
              )}
              <div className="admin-actions">
                <AdminAction
                  url={`/api/admin/teachers/applications/${a.id}`}
                  body={{ decision: "approve" }}
                  label="Approve"
                  confirm={`Make ${a.user.email} a teacher?`}
                  testId="approve"
                />
                <AdminAction
                  url={`/api/admin/teachers/applications/${a.id}`}
                  body={{ decision: "reject" }}
                  label="Reject"
                  prompt="Reject this application. A note for the applicant (optional — they will see it):"
                  danger
                  testId="reject"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Teachers ({grants.filter((g) => !g.revokedAt).length})</h2>
        <GrantTeacherForm />
        <table className="admin-table" data-testid="grants">
          <thead>
            <tr>
              <th>Email</th>
              <th>Granted</th>
              <th>Terms</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className={g.revokedAt ? "muted" : undefined} data-testid={`grant-${g.email}`}>
                <td>{g.email}</td>
                <td>
                  {when(g.grantedAt)} <span className="muted">by {g.grantedBy}</span>
                </td>
                <td>
                  {g.revokedAt ? (
                    <span className="badge tone-danger">revoked {when(g.revokedAt)}</span>
                  ) : g.termsVersion === TEACHER_TERMS_VERSION ? (
                    <span className="badge tone-success">accepted</span>
                  ) : (
                    <span className="badge tone-warning">not yet</span>
                  )}
                </td>
                <td>
                  {g.revokedAt ? (
                    <AdminAction
                      url="/api/admin/teachers"
                      body={{ action: "grant", email: g.email }}
                      label="Restore"
                      confirm={`Give ${g.email} the teacher role back?`}
                    />
                  ) : (
                    <AdminAction
                      url="/api/admin/teachers"
                      body={{ action: "revoke", email: g.email }}
                      label="Revoke"
                      confirm={`Take the teacher role from ${g.email}? Their existing classes are not touched — suspend those separately if needed.`}
                      danger
                      testId="revoke"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {decided.length > 0 && (
        <section>
          <h2>Recent decisions</h2>
          <ul className="admin-list compact">
            {decided.map((a) => (
              <li key={a.id}>
                <span className={`badge ${a.status === "approved" ? "tone-success" : "tone-danger"}`}>{a.status}</span>{" "}
                {a.user.name ?? a.user.email} <span className="muted">{a.user.email}</span>
                {a.reviewedAt && (
                  <span className="muted">
                    {" "}
                    · {when(a.reviewedAt)} by {a.reviewedBy}
                  </span>
                )}
                {a.reviewNote && <span className="muted"> · “{a.reviewNote}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
