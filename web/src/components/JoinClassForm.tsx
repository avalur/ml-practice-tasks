"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* The invite code no longer unlocks anything — the class, its lessons and its
 * tasks are public. It puts the student into a group, which is what lets the
 * teacher follow their homework. Hence the wording. */
export function JoinClassForm({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ kind: "ok", text: `Joined ${data.title} — group “${data.group}”.` });
        setCode("");
        router.refresh();
      } else if (res.status === 401) {
        setMsg({ kind: "err", text: "Sign in first, then enter the code." });
      } else {
        setMsg({ kind: "err", text: data.error ?? "Could not join." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error — try again." });
    }
    setBusy(false);
  }

  return (
    <form className="class-join" onSubmit={submit}>
      <label htmlFor="class-code">
        Got a group code from your teacher? Enter it so your homework is counted.
      </label>
      <div className="class-join-row">
        <input
          id="class-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={placeholder ?? "e.g. TLF-OSEN-A"}
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
        />
        <button type="submit" className="bt-clear-btn" disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      {msg && (
        <p className={msg.kind === "ok" ? "class-join-ok" : "class-join-err"}>{msg.text}</p>
      )}
    </form>
  );
}
