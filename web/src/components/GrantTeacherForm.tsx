"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Make somebody a teacher without an application — a colleague you already
 * know. Works for an address that has no account yet. */
export function GrantTeacherForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmail("");
        router.refresh();
      } else {
        setErr(data.error ?? "Could not grant.");
      }
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <form className="class-join" onSubmit={submit} data-testid="grant-form">
      <label htmlFor="grant-email">Grant the teacher role by email</label>
      <div className="class-join-row">
        <input
          id="grant-email"
          type="email"
          className="plain"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@school.org"
          autoComplete="off"
        />
        <button type="submit" className="bt-clear-btn" disabled={busy || !email.trim()}>
          {busy ? "Granting…" : "Grant"}
        </button>
      </div>
      {err && <p className="class-join-err">{err}</p>}
    </form>
  );
}
