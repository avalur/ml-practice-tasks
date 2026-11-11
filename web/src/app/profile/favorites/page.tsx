import Link from "next/link";

import { prisma } from "@/lib/db";
import { profileUser } from "@/lib/student";
import { DifficultyBadge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Favorites — ML Practice" };

export default async function FavoritesPage() {
  const user = await profileUser();
  if (!user) return null;

  const favs = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { problem: { select: { title: true, topic: true, slug: true, difficulty: true } } },
  });
  const solved = new Set(
    (
      await prisma.userProblemProgress.findMany({
        where: { userId: user.id, clientSolved: true, problemId: { in: favs.map((f) => f.problemId) } },
        select: { problemId: true },
      })
    ).map((r) => r.problemId),
  );

  return (
    <>
      <PageHeader title="Favorites" subtitle="Problems you starred to come back to." />
      {favs.length === 0 ? (
        <EmptyState title="No favorites yet">
          Click ★ on any problem to save it here.
        </EmptyState>
      ) : (
        <ul className="problem-list">
          {favs.map((f) => (
            <li key={f.id}>
              <Link href={`/problems/${f.problem.topic}/${f.problem.slug}`} className="problem-card">
                <span className="title">
                  {solved.has(f.problemId) && <span className="result-good">✓ </span>}
                  {f.problem.title}
                </span>
                <span className="meta">
                  <DifficultyBadge difficulty={f.problem.difficulty} />
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
