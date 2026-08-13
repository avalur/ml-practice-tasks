"use client";

import { useEffect, useState } from "react";

import { isLang, verdictAt, type BoardDTO, type Lang, type Level } from "@/lib/abacus";
import { useAbacusBoard } from "@/components/useAbacusBoard";

export type MonitorTheme = { id: string; titleRu: string; titleEn: string; points: number[] };

const UI = {
  ru: {
    waiting: "Пока никто не подключился. Код на экране — вводите на",
    score: "баллов",
    closed: "Игра завершена",
    stale: "нет связи — показано последнее",
    of: "из",
  },
  en: {
    waiting: "Nobody has joined yet. The code is on the screen — enter it at",
    score: "points",
    closed: "Game over",
    stale: "offline — showing the last board",
    of: "of",
  },
} satisfies Record<Lang, Record<string, string>>;

const LANG_KEY = "mlp:abacus:lang";

/* The projector view: one column per team, each a 3×3 of verdicts and a score.
 *
 * Public by code on purpose — it is meant to be thrown on a wall and opened by
 * anyone in the room, and a team name is all it shows. Four columns is the
 * design target; a fifth team wraps rather than shrinking the type. */
export function AbacusMonitor({
  code,
  initial,
  themes,
  compact = false,
}: {
  code: string;
  initial: BoardDTO;
  themes: Record<Level, MonitorTheme[]>;
  /** Embedded under a team's own board rather than filling a screen. */
  compact?: boolean;
}) {
  const { board, stale } = useAbacusBoard(code, initial);
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(fromUrl)) setLang(fromUrl);
    else if (isLang(stored)) setLang(stored);
  }, []);

  const t = UI[lang];
  const ranked = [...board.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <div className={`abx-monitor${compact ? " is-compact" : ""}`} data-testid="abx-monitor">
      <div className="abx-monitor-head">
        <span className="abx-code" data-testid="abx-code">
          {board.code}
        </span>
        {board.title && <span className="muted">{board.title}</span>}
        {board.closed && <span className="badge hard">{t.closed}</span>}
        {stale && <span className="muted abx-stale">{t.stale}</span>}
        <div className="abacus-lang" role="group" aria-label="Language">
          {(["ru", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`abacus-lang-btn${lang === l ? " is-active" : ""}`}
              aria-pressed={lang === l}
              onClick={() => {
                setLang(l);
                localStorage.setItem(LANG_KEY, l);
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="muted abx-waiting">
          {t.waiting} <strong>/brainteasers/abacus/join</strong>
        </p>
      ) : (
        <div className="abx-teams">
          {ranked.map((team, rank) => (
            <section key={team.id} className="abx-team" data-testid={`abx-team-${team.name}`}>
              <header className="abx-team-head">
                <span className="abx-rank">{rank + 1}</span>
                <span className="abx-team-name">{team.name}</span>
                <span className="badge medium abx-team-level">{team.level}</span>
              </header>
              <div className="abx-score" data-testid={`abx-score-${team.name}`}>
                {team.score}
                <span className="abx-score-unit">{t.score}</span>
              </div>
              <table className="abx-grid">
                <tbody>
                  {themes[team.level].map((theme) => (
                    <tr key={theme.id}>
                      <th scope="row">{lang === "ru" ? theme.titleRu : theme.titleEn}</th>
                      {theme.points.map((points, i) => {
                        const v = verdictAt(team.verdicts, theme.id, i);
                        const state = !v ? "open" : v.correct ? "ok" : "bad";
                        return (
                          <td
                            key={i}
                            className="abx-cell"
                            data-state={state}
                            data-testid={`abx-cell-${team.name}-${theme.id}-${i}`}
                          >
                            {v ? (v.correct ? `+${v.points}` : "✗") : points}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
