"use client";

import { useState } from "react";

/** Starts (or resumes) a lesson session, then opens the deck in present mode.
 *
 * The session id is what turns the standalone present.html from a read-only deck
 * into an annotatable one — annotate.js only attaches when `?session=` is set.
 */
export function PresentButton({
  classSlug,
  lessonSlug,
}: {
  classSlug: string;
  lessonSlug: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function present() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(classSlug)}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Could not start the lesson.");
        setBusy(false);
        return;
      }
      const url =
        `/classes/${classSlug}/${lessonSlug}/present.html` +
        `?session=${encodeURIComponent(data.id)}`;
      window.open(url, "_blank", "noopener");
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button className="class-present-btn" onClick={present} disabled={busy}>
        {busy ? "Starting…" : "▶ Present"}
      </button>
      {err && <p className="class-join-err">{err}</p>}
    </>
  );
}
