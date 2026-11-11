import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { AdminAction } from "@/components/AdminAction";
import type { ProposalCheck } from "@/lib/proposal-shared";

const when = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* Task proposals from teachers. Accepting only marks one ready: the files land
 * in problems/ through `pnpm db:proposal <id>` on a machine with the repo, so
 * the real pytest and the usual review of a diff still stand between a
 * proposal and the catalogue. */
export default async function AdminProposalsPage() {
  if (!(await isSiteAdmin())) notFound();
  const [pending, recent] = await Promise.all([
    prisma.problemProposal.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.problemProposal.findMany({
      where: { status: { not: "pending" } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      select: { id: true, topic: true, slug: true, title: true, status: true, reviewedBy: true },
    }),
  ]);

  return (
    <article>
      <h1>Task proposals</h1>
      <section data-testid="pending-proposals">
        <h2>To review ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">Nothing waiting.</p>}
        {pending.map((p) => {
          const check = p.check as ProposalCheck | null;
          return (
            <div key={p.id} className="admin-card" data-testid={`proposal-${p.slug}`}>
              <p>
                <strong>{p.title}</strong>{" "}
                <span className="muted">
                  {p.topic}/{p.slug} · {p.difficulty} · <code>{p.entry}()</code> · by {p.user.name ?? p.user.email} (
                  {p.user.email}) · {when(p.createdAt)}
                </span>
              </p>
              <p className="muted">
                Browser check:{" "}
                {check
                  ? `reference ${check.referencePassed}/${check.referenceTotal}, stub ${check.stubFailed ? "fails" : "PASSES"}`
                  : "not run"}{" "}
                · banned <code>{JSON.stringify(p.banned)}</code> · deps <code>{JSON.stringify(p.pyDeps)}</code>
              </p>
              <p className="admin-quote">{p.statement}</p>
              <details>
                <summary>reference.py</summary>
                <pre className="admin-code">{p.reference}</pre>
              </details>
              <details>
                <summary>test.py</summary>
                <pre className="admin-code">{p.test}</pre>
              </details>
              <div className="admin-actions">
                <AdminAction
                  url={`/api/admin/proposals/${p.id}`}
                  body={{ decision: "accept" }}
                  label="Accept"
                  confirm={`Accept ${p.topic}/${p.slug}? Then run: cd web && pnpm db:proposal ${p.id}`}
                  testId="accept"
                />
                <AdminAction
                  url={`/api/admin/proposals/${p.id}`}
                  body={{ decision: "reject" }}
                  label="Reject"
                  prompt="A note for the teacher (optional):"
                  danger
                />
              </div>
            </div>
          );
        })}
      </section>
      {recent.length > 0 && (
        <section>
          <h2>Recently answered</h2>
          <ul className="admin-list compact">
            {recent.map((p) => (
              <li key={p.id}>
                <span className={`badge ${p.status === "rejected" ? "tone-danger" : "tone-success"}`}>{p.status}</span> {p.title}{" "}
                <span className="muted">
                  {p.topic}/{p.slug} · by {p.reviewedBy}
                  {p.status === "accepted" && (
                    <>
                      {" "}
                      · import with <code>pnpm db:proposal {p.id}</code>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
