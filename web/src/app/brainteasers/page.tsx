import Link from "next/link";
import type { Metadata } from "next";

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
];

export default function BrainTeasersPage() {
  return (
    <article>
      <h1>Brain Teasers</h1>
      <p className="muted">
        Logic and math puzzles — different format for each challenge.
      </p>

      <ul className="problem-list" style={{ marginTop: "1.5rem" }}>
        {TEASERS.map((t) => (
          <li key={t.slug}>
            <Link href={`/brainteasers/${t.slug}`} className="problem-card">
              <span className="title">{t.title}</span>
              <span className="meta">
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
