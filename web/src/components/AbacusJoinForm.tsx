"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LEVELS, type Level } from "@/content/abacus";

const LEVEL_LABEL: Record<Level, { name: string; ages: string }> = {
  hard: { name: "Hard", ages: "10–12 лет · ages 10–12" },
  extreme: { name: "Extreme", ages: "13–15 лет · ages 13–15" },
  nightmare: { name: "Nightmare", ages: "16+ · ages 16+" },
};

/* Joining takes a code, a team name and a difficulty — no account, no email.
 * Bilingual labels: the room is Russian, the site is English, and this is the
 * one page a ten-year-old meets before anything else. */
export function AbacusJoinForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim() || !name.trim() || !level) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/abacus/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, level }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Не получилось войти.");
      else {
        // The cookie is set on the reply; the team page reads it server-side.
        router.push("/brainteasers/abacus/team");
        router.refresh();
      }
    } catch {
      setErr("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="abx-join" onSubmit={submit}>
      <label htmlFor="abx-code">Код игры · Game code</label>
      <input
        id="abx-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC-234"
        autoComplete="off"
        spellCheck={false}
        maxLength={24}
      />

      <label htmlFor="abx-name">Название команды · Team name</label>
      <input
        id="abx-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Пифагоры"
        autoComplete="off"
        maxLength={40}
      />

      <span className="abx-join-label">Уровень · Difficulty</span>
      <div className="abx-levels">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            className={`abacus-level${level === l ? " is-active" : ""}`}
            aria-pressed={level === l}
            data-testid={`abx-level-${l}`}
            onClick={() => setLevel(l)}
          >
            <span className="abacus-level-name">{LEVEL_LABEL[l].name}</span>
            <span className="abacus-level-ages">{LEVEL_LABEL[l].ages}</span>
          </button>
        ))}
      </div>

      <button
        type="submit"
        className="btn primary abx-join-go"
        data-testid="abx-join"
        disabled={busy || !code.trim() || !name.trim() || !level}
      >
        {busy ? "Входим…" : "Играть · Play"}
      </button>
      {err && <p className="class-join-err">{err}</p>}
    </form>
  );
}
