import Link from "next/link";

export const metadata = { title: "Not found — ML Practice" };

export default function NotFound() {
  return (
    <section className="status-page" data-testid="not-found">
      <p className="status-code">404</p>
      <h1>This page does not exist</h1>
      <p className="muted">
        The link may be old, or the page may belong to a class that is not published.
      </p>
      <p className="status-actions">
        <Link className="btn primary" href="/problems">
          Browse problems
        </Link>
        <Link className="btn" href="/classes">
          Classes
        </Link>
        <Link className="btn subtle" href="/">
          Home
        </Link>
      </p>
    </section>
  );
}
