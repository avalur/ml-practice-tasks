import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Submission — ML Practice" };

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <section>
        <h1>Submission</h1>
        <p className="muted">Sign in to view your submissions.</p>
      </section>
    );
  }

  const sub = await prisma.submission.findUnique({
    where: { id },
    include: {
      problem: { select: { title: true, topic: true, slug: true, difficulty: true } },
    },
  });
  // Owner-only: don't reveal that someone else's submission exists.
  if (!sub || sub.userId !== session.user.id) notFound();

  const ok = sub.total > 0 && sub.passed === sub.total;
  const when = new Date(sub.createdAt).toISOString().slice(0, 16).replace("T", " ");

  return (
    <article>
      <p className="muted">
        <Link href="/profile">← Profile</Link>
      </p>
      <div className="problem-head">
        <h1 style={{ margin: 0 }}>{sub.problem.title}</h1>
        <span className={`badge ${sub.problem.difficulty}`}>
          {sub.problem.difficulty}
        </span>
      </div>
      <p>
        <span className={ok ? "result-good" : "result-bad"}>
          {sub.passed}/{sub.total} passed
        </span>
        <span className="muted"> · {when} UTC · </span>
        <Link href={`/problems/${sub.problem.topic}/${sub.problem.slug}`}>
          open problem
        </Link>
      </p>

      <h2>Submitted code</h2>
      <pre className="code">{sub.code}</pre>
    </article>
  );
}
