"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinClassForm() {
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
        setMsg({ kind: "ok", text: `Joined ${data.title}.` });
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
      <label htmlFor="class-code">Have an invite code?</label>
      <div className="class-join-row">
        <input
          id="class-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 83M8YV"
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
        />
        <button type="submit" className="bt-clear-btn" disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join class"}
        </button>
      </div>
      {msg && (
        <p className={msg.kind === "ok" ? "class-join-ok" : "class-join-err"}>{msg.text}</p>
      )}
    </form>
  );
}
