import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teacherState } from "@/lib/teachers";
import { ProposalEditor } from "@/components/ProposalEditor";

export const metadata: Metadata = { title: "Task proposals — Studio" };

const when = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function StudioProposalsPage() {
  if ((await teacherState()).kind !== "active") redirect("/teach");
  const session = await auth();
  const mine = await prisma.problemProposal.findMany({
    where: { userId: session!.user!.id! },
    orderBy: { createdAt: "desc" },
    select: { id: true, topic: true, slug: true, title: true, status: true, reviewNote: true, createdAt: true },
  });

  return (
    <article className="studio studio-wide">
      <p className="muted class-breadcrumb">
        <Link href="/studio">Studio</Link> › Task proposals
      </p>
      <h1>Propose a task</h1>
      <p className="muted">
        Every task on the site is solved by hand and checked by pytest. A proposal is reviewed by the site&rsquo;s editors
        before it joins the catalogue — then any teacher can use it. Use the existing tasks as models: one idea per task,
        an independent oracle in the tests, and a ban on the shortcut that would make it a one-liner.
      </p>

      {mine.length > 0 && (
        <section>
          <h2>Your proposals</h2>
          <ul className="admin-list compact" data-testid="my-proposals">
            {mine.map((p) => (
              <li key={p.id}>
                <span
                  className={`badge ${p.status === "rejected" ? "hard" : p.status === "pending" ? "medium" : "easy"}`}
                >
                  {p.status}
                </span>{" "}
                <strong>{p.title}</strong> <span className="muted">{p.topic}/{p.slug} · {when(p.createdAt)}</span>
                {p.reviewNote && <span className="muted"> · “{p.reviewNote}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>New proposal</h2>
      <ProposalEditor />
    </article>
  );
}
