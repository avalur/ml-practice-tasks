import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";
import { computeStreak } from "@/lib/stats";
import { ProfileNav } from "./ProfileNav";

export const metadata = { title: "Profile — ML Practice" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <section>
        <h1>Profile</h1>
        <p className="muted">Sign in to track your progress.</p>
      </section>
    );
  }

  const { tab = "submissions" } = await searchParams;
  const userId = session.user.id;

  const [solvedCount, streak, manifest] = await Promise.all([
    prisma.userProblemProgress.count({ where: { userId, clientSolved: true } }),
    computeStreak(userId),
    getManifest(),
  ]);
  const total = visibleProblems(manifest).length;

  return (
    <div className="profile-layout">
      <ProfileNav
        activeTab={tab}
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        streak={streak}
        solvedCount={solvedCount}
        totalCount={total}
      />

      <section>
        {tab === "favorites" ? (
          <FavoritesTab userId={userId} manifest={manifest} />
        ) : (
          <SubmissionsTab userId={userId} />
        )}
      </section>
    </div>
  );
}

async function SubmissionsTab({ userId }: { userId: string }) {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { problem: { select: { title: true, topic: true, slug: true } } },
  });

  return (
    <>
      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <p className="muted">No submissions yet — go solve something!</p>
      ) : (
        <ul className="problem-list">
          {submissions.map((s) => {
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
    </>
  );
}

async function FavoritesTab({
  userId,
  manifest,
}: {
  userId: string;
  manifest: Awaited<ReturnType<typeof getManifest>>;
}) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { problem: { select: { title: true, topic: true, slug: true, difficulty: true } } },
  });

  return (
    <>
      <h2>Favorites</h2>
      {favs.length === 0 ? (
        <p className="muted">
          No favorites yet — click ★ on any problem to save it here.
        </p>
      ) : (
        <ul className="problem-list">
          {favs.map((f) => (
            <li key={f.id}>
              <Link
                href={`/problems/${f.problem.topic}/${f.problem.slug}`}
                className="problem-card"
              >
                <span className="title">{f.problem.title}</span>
                <span className="meta">
                  <span className={`badge ${f.problem.difficulty}`}>
                    {f.problem.difficulty}
                  </span>
                  <span className="topic-tag">{f.problem.topic}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
