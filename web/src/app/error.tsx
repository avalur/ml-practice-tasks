"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="status-page" data-testid="error-page">
      <p className="status-code">Error</p>
      <h1>Something went wrong</h1>
      <p className="muted">
        The page failed to load. Trying again usually helps; if it keeps happening, the
        reference below tells us where to look.
      </p>
      {error.digest && (
        <p className="muted">
          Reference: <code>{error.digest}</code>
        </p>
      )}
      <p className="status-actions">
        <button type="button" className="btn primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn subtle" href="/">
          Home
        </Link>
      </p>
    </section>
  );
}
