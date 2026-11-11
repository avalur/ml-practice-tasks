import Link from "next/link";

import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";

/* Static on purpose: no session read here, so the landing page is served from
 * the CDN. Your own progress lives one click away on /profile. */

const FAMILY_LABEL: Record<string, string> = {
  py: "Python fundamentals",
  numpy: "NumPy & ML mechanics",
  pandas: "pandas",
  agents: "AI agents",
};

export default async function HomePage() {
  const problems = visibleProblems(await getManifest());
  const families = new Map<string, number>();
  for (const p of problems) {
    const fam = p.topic.split("_")[0]!;
    families.set(fam, (families.get(fam) ?? 0) + 1);
  }

  return (
    <div className="home">
      <section className="home-hero">
        <h1>
          Practice machine learning <span className="home-accent">by hand</span>
        </h1>
        <p className="home-lead">
          Small, focused exercises where you write the mechanics yourself — no ready-made
          helpers. The tests run <strong>entirely in your browser</strong>: nothing to
          install, results in seconds.
        </p>
        <div className="home-cta">
          <Link className="btn primary large" href="/problems">
            Start solving
          </Link>
          <Link className="btn large" href="/classes">
            Browse classes
          </Link>
        </div>
      </section>

      <section className="home-grid" aria-label="What is here">
        <Link href="/problems" className="card home-card">
          <span className="home-card-kicker">{problems.length} tasks</span>
          <h2 className="card-title">Problems</h2>
          <p className="muted">
            One concept per task, checked by pytest against an independent oracle.
          </p>
          <ul className="home-families">
            {[...families].map(([fam, n]) => (
              <li key={fam}>
                <span>{FAMILY_LABEL[fam] ?? fam}</span>
                <span className="muted">{n}</span>
              </li>
            ))}
          </ul>
        </Link>
        <Link href="/notebooks" className="card home-card">
          <span className="home-card-kicker">Interactive</span>
          <h2 className="card-title">Notebooks</h2>
          <p className="muted">
            Reactive notebooks that run in the page — explore an idea, change a parameter,
            watch the plot follow.
          </p>
        </Link>
        <Link href="/classes" className="card home-card">
          <span className="home-card-kicker">Taught courses</span>
          <h2 className="card-title">Classes</h2>
          <p className="muted">
            Lecture slides, in-class practice and homework. Open to read; join your group
            with the code your teacher hands out.
          </p>
        </Link>
      </section>

      <section className="home-steps" aria-label="How it works">
        <div>
          <span className="home-step">1</span>
          <h3>Read the statement</h3>
          <p className="muted">Each task says what is banned — the shortcut that would make it a one-liner.</p>
        </div>
        <div>
          <span className="home-step">2</span>
          <h3>Write the code</h3>
          <p className="muted">A real editor in the browser, with Python running locally via Pyodide.</p>
        </div>
        <div>
          <span className="home-step">3</span>
          <h3>Run the tests</h3>
          <p className="muted">Sign in and your progress, streak and submissions are kept for you.</p>
        </div>
      </section>

      <p className="home-teach muted">
        Teaching a course? <Link href="/teach">Build it here</Link> from these tasks and your own
        slides.
      </p>
    </div>
  );
}
