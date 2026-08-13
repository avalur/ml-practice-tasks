import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import { ABACUS } from "@/content/abacus";
import { prisma } from "@/lib/db";
import { renderGame } from "@/lib/abacus-render";
import { teaserAccess } from "@/lib/teasers";
import { AbacusBoard } from "@/components/AbacusBoard";
import { AbacusSessionStrip, type SessionRow } from "@/components/AbacusSessionStrip";

export async function generateMetadata(): Promise<Metadata> {
  // A draft's title should not leak through <title> either.
  const access = await teaserAccess(ABACUS.slug);
  if (!access.visible) return { title: "Brain Teasers — ML Practice" };
  return {
    title: "Math Abacus — ML Practice",
    description:
      "A team contest board: themes of problems that get dearer, handed in strictly in order.",
  };
}

export default async function AbacusPage() {
  const access = await teaserAccess(ABACUS.slug);
  if (!access.visible) notFound();

  // Statements are turned into HTML here, in both languages, so the board can
  // switch language without a round trip and without shipping marked + katex.
  const game = await renderGame(ABACUS);

  // The editor also gets the events: this is where one is opened, and where the
  // running ones are reachable from.
  const sessions: SessionRow[] = access.admin
    ? (
        await prisma.abacusSession.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            code: true,
            title: true,
            closedAt: true,
            _count: { select: { teams: true } },
          },
        })
      ).map((s) => ({
        code: s.code,
        title: s.title,
        teams: s._count.teams,
        closed: s.closedAt !== null,
      }))
    : [];

  return (
    <>
      {access.admin && <AbacusSessionStrip sessions={sessions} />}
      <AbacusBoard game={game} admin={access.admin} published={access.published} />
    </>
  );
}
