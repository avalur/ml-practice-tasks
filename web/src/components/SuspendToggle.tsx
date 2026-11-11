"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* The admin's moderation switch for one class. Suspending asks for the reason,
 * because the teachers are shown it on their class page; lifting needs only a
 * confirmation. */
export function SuspendToggle({ slug, suspended }: { slug: string; suspended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function set(next: boolean) {
    if (busy) return;
    let reason = "";
    if (next) {
      const typed = window.prompt(
        "Why is this class being suspended? The teachers will see this text.",
      );
      if (typed === null) return;
      reason = typed.trim();
      if (!reason) {
        setErr("A reason is required.");
        return;
      }
    } else if (!window.confirm("Lift the suspension? The class goes back to its published state.")) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/classes/${slug}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: next, reason }),
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
        className="btn subtle small danger"
        disabled={busy}
        data-testid="suspend-toggle"
        onClick={() => set(!suspended)}
      >
        {busy ? "Saving…" : suspended ? "Lift suspension" : "Suspend class"}
      </button>
      {err && <span className="class-join-err">{err}</span>}
    </>
  );
}
