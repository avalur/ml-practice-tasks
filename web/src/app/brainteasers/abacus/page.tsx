import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import { ABACUS } from "@/content/abacus";
import { renderGame } from "@/lib/abacus-render";
import { teaserAccess } from "@/lib/teasers";
import { AbacusBoard } from "@/components/AbacusBoard";

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
  return <AbacusBoard game={game} admin={access.admin} published={access.published} />;
}
