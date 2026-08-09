"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type InviteRow = {
  id: string;
  code: string;
  label: string;
  students: number;
};

/* Teacher-side code management.
 *
 * One class, several codes: each one names a group, and the code a student typed
 * is what puts them in a column of the homework overview. The teacher writes the
 * code by hand — it gets read out to a room, so "TLF-OSEN-A" beats a random
 * string — and the prefix is only a suggestion, prefilled into the field. */
export function InviteCodes({
  slug,
  prefix,
  invites,
}: {
  slug: string;
  prefix: string;
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(prefix);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/classes/${slug}/invites`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Request failed.");
      else router.refresh();
      return res.ok;
    } catch {
      setErr("Network error — try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const ok = await call("POST", { code, label });
    if (ok) {
      setCode(prefix);
      setLabel("");
    }
  }

  return (
    <section className="invite-codes">
      <h2>Group codes</h2>
      <p className="muted">
        Anyone can read the lessons. A code is how a student joins a group, which
        is what puts them in the table below.
      </p>

      {invites.length > 0 && (
        <ul className="invite-list">
          {invites.map((inv) => (
            <li key={inv.id}>
              <code className="class-code">{inv.code}</code>
              <span className="invite-label">{inv.label}</span>
              <span className="muted">
                {inv.students} student{inv.students === 1 ? "" : "s"}
              </span>
              {inv.students === 0 && (
                <button
                  type="button"
                  className="bt-clear-btn"
                  disabled={busy}
                  onClick={() => call("DELETE", { id: inv.id })}
                >
                  delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="invite-new" onSubmit={add}>
        <input
          aria-label="New code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={`${prefix}OSEN-A`}
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
        />
        <input
          aria-label="Group name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Autumn stream A"
          autoComplete="off"
          maxLength={60}
        />
        <button
          type="submit"
          className="bt-clear-btn"
          disabled={busy || !label.trim() || code.trim().length < 4}
        >
          {busy ? "Saving…" : "New code"}
        </button>
      </form>
      {err && <p className="class-join-err">{err}</p>}
    </section>
  );
}
