"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Accepts the terms the page rendered. The version travels with the click, so
 * consent is recorded for the text actually shown (the route refuses a stale one). */
export function AcceptTermsButton({ version }: { version: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    if (busy || !agreed) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/teach/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setErr(data.error ?? "Could not save.");
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="teach-accept">
      <label>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> I
        have read the terms above and agree to them.
      </label>
      <button
        type="button"
        className="class-present-btn"
        disabled={busy || !agreed}
        onClick={accept}
        data-testid="accept-terms"
      >
        {busy ? "Saving…" : "Accept and continue"}
      </button>
      {err && <p className="class-join-err">{err}</p>}
    </div>
  );
}
