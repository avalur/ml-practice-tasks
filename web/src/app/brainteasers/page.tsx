import Link from "next/link";
import type { Metadata } from "next";

import { isGatedTeaser, teaserAccess } from "@/lib/teasers";

export const metadata: Metadata = {
  title: "Brain Teasers — ML Practice",
  description: "Logic and math puzzles to keep your brain sharp.",
};

const TEASERS = [
  {
    slug: "alzheimer-math",
    title: "Alzheimer's Prevention: Math Edition",
    description: "Arrange digit and operator tiles to form valid equations. Combine digits, use parentheses — everything can move.",
    difficulty: "medium",
    count: 3,
  },
  {
    slug: "abacus",
    title: "Math Abacus",
    description:
      "A team contest board — themes of problems that get dearer, handed in strictly in order. Russian and English, and the statements print to PDF.",
    difficulty: "medium",
    count: 9,
  },
  {
    slug: "complete-the-integral",
    title: "Complete the Integral",
    description: "Place three numbers into the integral formula so that the equation holds: ∫ₐᵇ x dx = c.",
    difficulty: "easy",
    count: 1,
  },
];

export default async function BrainTeasersPage() {
  // A gated teaser is listed once it is published — or always, to the editor who
  // is still writing it, with a badge saying so.
  const gated = await Promise.all(
    TEASERS.filter((t) => isGatedTeaser(t.slug)).map(async (t) => ({
      slug: t.slug,
      access: await teaserAccess(t.slug),
    })),
  );
  const state = new Map(gated.map((g) => [g.slug, g.access]));
  const visible = TEASERS.filter((t) => state.get(t.slug)?.visible ?? true);

  return (
    <article>
      <h1>Brain Teasers</h1>
      <p className="muted">
        Logic and math puzzles — different format for each challenge.
      </p>

      <ul className="problem-list" style={{ marginTop: "1.5rem" }}>
        {visible.map((t) => (
          <li key={t.slug}>
            <Link href={`/brainteasers/${t.slug}`} className="problem-card">
              <span className="title">{t.title}</span>
              <span className="meta">
                {state.get(t.slug)?.published === false && (
                  <span className="badge medium">draft</span>
                )}
                <span className={`badge ${t.difficulty}`}>{t.difficulty}</span>
                <span className="muted">{t.count} puzzles</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
