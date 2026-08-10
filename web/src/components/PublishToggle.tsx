"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Publish / Unpublish, in the teacher bar of the class page.
 *
 * Publishing is one click. Hiding a class again asks first, because "draft" here
 * means teachers only: the students who already typed a group code lose the class
 * page too, and that is not obvious from a button labelled "Unpublish". */
export function PublishToggle({ slug, published }: { slug: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function set(next: boolean) {
    if (busy) return;
    if (
      !next &&
      !window.confirm(
        "Hide this class? It disappears from the public list, and its pages " +
          "answer 404 to everyone but you — including the students who joined a " +
          "group. Their enrolments and homework are kept.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/classes/${slug}/publish`, {
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
        data-testid="publish-toggle"
        onClick={() => set(!published)}
      >
        {busy ? "Saving…" : published ? "Unpublish" : "Publish"}
      </button>
      {err && <span className="class-join-err">{err}</span>}
    </>
  );
}
