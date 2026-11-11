"use client";

import { useState } from "react";

/* Account → Password. Only rendered for an account that already has one; the
 * route refuses the others and points them at the reset-by-email flow. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, password: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setCurrent("");
      setNext("");
      setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
    } else {
      setMsg({ ok: false, text: data.error ?? "Could not change the password." });
    }
  }

  return (
    <div className="auth-card">
      <form onSubmit={submit} data-testid="change-password">
        <label htmlFor="pw-current">Current password</label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <label htmlFor="pw-new">New password</label>
        <input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || !current || !next}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
      {msg && (
        <p className={msg.ok ? "result-good" : "class-join-err"} role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
