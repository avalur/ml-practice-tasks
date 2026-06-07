import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";
import { computeStreak } from "@/lib/stats";

export const metadata = { title: "Profile — ML Practice" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <section>
        <h1>Profile</h1>
        <p className="muted">Sign in to track your progress.</p>
      </section>
    );
  }

  const userId = session.user.id;
  const [solvedCount, recent, streak, manifest] = await Promise.all([
    prisma.userProblemProgress.count({ where: { userId, clientSolved: true } }),
    prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { problem: { select: { title: true, topic: true, slug: true } } },
    }),
    computeStreak(userId),
    getManifest(),
  ]);
  const total = visibleProblems(manifest).length;

  return (
    <section>
      <h1>Profile</h1>
      <p>
        Signed in as <strong>{session.user.name ?? session.user.email}</strong>
      </p>
      {streak > 0 && <p className="streak">🔥 {streak}-day streak</p>}
      <p className="result-good">
        {solvedCount}/{total} solved
      </p>

      <h2>Recent submissions</h2>
      {recent.length === 0 ? (
        <p className="muted">No submissions yet — go solve something!</p>
      ) : (
        <ul className="problem-list">
          {recent.map((s) => {
            const ok = s.total > 0 && s.passed === s.total;
            return (
              <li key={s.id}>
                <Link
                  href={`/problems/${s.problem.topic}/${s.problem.slug}?submission=${s.id}`}
                  className="problem-card"
                >
                  <span className="title">{s.problem.title}</span>
                  <span className="meta">
                    <span className={ok ? "result-good" : "result-bad"}>
                      {s.passed}/{s.total}
                    </span>
                    <span className="topic-tag">
                      {new Date(s.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
