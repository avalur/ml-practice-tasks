import Link from "next/link";
import type { Metadata } from "next";
import manifest from "../../../../notebooks/manifest.json";

export const metadata: Metadata = {
  title: "Notebooks — ML Practice",
  description: "Interactive marimo notebooks — edit code, see results live in the browser.",
};

export default function NotebooksPage() {
  return (
    <article>
      <h1>Notebooks</h1>
      <p className="muted">
        Reactive Python notebooks powered by{" "}
        <a href="https://marimo.io" target="_blank" rel="noopener noreferrer">
          marimo
        </a>{" "}
        — edit code and see results update live in the browser, no install required.
      </p>

      {manifest.sections.map((section) => (
        <section key={section.slug} style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: "0.25rem" }}>{section.title}</h2>
          <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
            {section.description}
          </p>
          <ul className="problem-list">
            {section.notebooks.map((nb) => (
              <li key={nb.slug}>
                <Link
                  href={`/notebooks/${section.slug}/${nb.slug}`}
                  className="problem-card"
                >
                  <span className="title">{nb.title}</span>
                  <span className="meta">
                    <span className={`badge ${nb.difficulty}`}>{nb.difficulty}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
