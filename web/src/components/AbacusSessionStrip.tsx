"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type SessionRow = {
  code: string;
  title: string | null;
  teams: number;
  closed: boolean;
};

/* Editor-only strip on the abacus page: open an event, and reach the ones that
 * are running. Leaving the code blank generates a speakable one. */
export function AbacusSessionStrip({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/abacus/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() || undefined, title: title.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Не получилось создать игру.");
      else {
        setCode("");
        setTitle("");
        router.push(`/brainteasers/abacus/s/${encodeURIComponent(data.code)}`);
      }
    } catch {
      setErr("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="abx-strip" data-testid="abx-strip">
      <form className="abx-strip-form" onSubmit={create}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название игры (необязательно)"
          maxLength={60}
          aria-label="Session title"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="код (или сгенерируем)"
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          aria-label="Session code"
        />
        <button type="submit" className="bt-clear-btn" data-testid="abx-create" disabled={busy}>
          {busy ? "…" : "Новая игра"}
        </button>
      </form>
      {err && <p className="class-join-err">{err}</p>}

      {sessions.length > 0 && (
        <ul className="abx-strip-list">
          {sessions.map((s) => (
            <li key={s.code}>
              <Link href={`/brainteasers/abacus/s/${encodeURIComponent(s.code)}`}>
                <span className="abx-code-small">{s.code}</span>
              </Link>
              {s.title && <span className="muted">{s.title}</span>}
              <span className="muted">
                {s.teams} команд{s.teams === 1 ? "а" : s.teams >= 2 && s.teams <= 4 ? "ы" : ""}
              </span>
              {s.closed && <span className="badge hard">завершена</span>}
              <Link className="muted" href={`/brainteasers/abacus/m/${encodeURIComponent(s.code)}`}>
                монитор
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
