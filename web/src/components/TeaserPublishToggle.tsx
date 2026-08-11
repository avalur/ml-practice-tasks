"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Publish / Unpublish a brain teaser, for a site editor (ADMIN_EMAILS).
 *
 * The sibling of PublishToggle on the class page, and deliberately a separate
 * component: a class asks about students who already joined, a teaser has none —
 * hiding it only takes it off the public list again. */
export function TeaserPublishToggle({
  slug,
  published,
}: {
  slug: string;
  published: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function set(next: boolean) {
    if (busy) return;
    if (
      !next &&
      !window.confirm("Hide this puzzle? It leaves the Brainteasers list and 404s for everyone but you.")
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/brainteasers/${slug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Request failed.");
      else router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="bt-clear-btn"
        disabled={busy}
        data-testid="teaser-publish-toggle"
        onClick={() => set(!published)}
      >
        {busy ? "Saving…" : published ? "Unpublish" : "Publish"}
      </button>
      {err && <span className="class-join-err">{err}</span>}
    </>
  );
}
