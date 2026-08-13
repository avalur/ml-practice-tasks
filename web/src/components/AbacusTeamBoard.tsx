"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  isLang,
  pick,
  verdictAt,
  type BoardDTO,
  type Lang,
  type Level,
  type RenderedVariant,
} from "@/lib/abacus";
import { useAbacusBoard } from "@/components/useAbacusBoard";
import { AbacusMonitor, type MonitorTheme } from "@/components/AbacusMonitor";

const LANG_KEY = "mlp:abacus:lang";

const UI = {
  ru: {
    score: "баллов",
    waiting: "жюри ещё не проверило",
    correct: "верно",
    wrong: "неверно",
    pick: "Выберите клетку, чтобы прочитать условие.",
    closed: "Игра завершена.",
    yours: "Ваша доска",
    all: "Общий монитор",
    hint: "Задачи сдаются по порядку — 10, 20, 30. Читать можно любую.",
  },
  en: {
    score: "points",
    waiting: "not judged yet",
    correct: "correct",
    wrong: "wrong",
    pick: "Pick a cell to read its statement.",
    closed: "The game is over.",
    yours: "Your board",
    all: "Everyone",
    hint: "Problems are handed in in order — 10, 20, 30. Reading is free.",
  },
} satisfies Record<Lang, Record<string, string>>;

/* A team's own screen during an event.
 *
 * Deliberately not the practice board: no cell is locked, because the hand-in
 * order is about handing in and they have the statements on paper anyway; and
 * nothing here can be clicked to claim a problem — the jury rules, this watches.
 */
export function AbacusTeamBoard({
  code,
  teamId,
  variant,
  initial,
  themes,
}: {
  code: string;
  teamId: string;
  /** The team's own level, with every statement already rendered. */
  variant: RenderedVariant;
  initial: BoardDTO;
  themes: Record<Level, MonitorTheme[]>;
}) {
  const { board } = useAbacusBoard(code, initial);
  const [lang, setLang] = useState<Lang>("ru");
  const [selected, setSelected] = useState<{ themeId: string; index: number } | null>(null);
  const [view, setView] = useState<"mine" | "all">("mine");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(fromUrl)) setLang(fromUrl);
    else if (isLang(stored)) setLang(stored);
  }, []);

  const t = UI[lang];
  const me = board.teams.find((x) => x.id === teamId);
  const theme = variant.themes.find((th) => th.id === selected?.themeId);
  const problem = selected ? theme?.problems[selected.index] : undefined;
  const mine = me?.verdicts ?? [];

  return (
    <article className="bt-page abacus-page">
      <div className="abacus-head">
        <h1>{me?.name ?? "…"}</h1>
        <div className="abacus-head-actions">
          <span className="badge medium">{variant.label}</span>
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
      </div>

      <div className="abx-team-bar">
        <span className="abx-score-inline" data-testid="abx-my-score">
          {me?.score ?? 0} <span className="abx-score-unit">{t.score}</span>
        </span>
        <div className="abacus-levels abx-views" role="tablist">
          {(["mine", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`abacus-level${view === v ? " is-active" : ""}`}
              data-testid={`abx-view-${v}`}
              onClick={() => setView(v)}
            >
              <span className="abacus-level-name">{v === "mine" ? t.yours : t.all}</span>
            </button>
          ))}
        </div>
        {board.closed && <span className="badge hard">{t.closed}</span>}
      </div>

      {view === "all" ? (
        <AbacusMonitor code={code} initial={board} themes={themes} compact />
      ) : (
        <>
          <div className="bt-rules">{t.hint}</div>

          <div
            className="abacus-grid"
            style={{ gridTemplateColumns: `minmax(7rem, 1fr) repeat(3, minmax(0, 1fr))` }}
          >
            {variant.themes.map((th) => (
              <div key={th.id} className="abacus-row">
                <div className="abacus-theme">{pick(th.title, lang)}</div>
                {th.problems.map((p, i) => {
                  const v = verdictAt(mine, th.id, i);
                  const isSelected = selected?.themeId === th.id && selected.index === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`abacus-cell${isSelected ? " is-selected" : ""}`}
                      data-state={!v ? "open" : v.correct ? "done" : "wrong"}
                      data-testid={`abx-my-cell-${th.id}-${i}`}
                      title={!v ? t.waiting : v.correct ? t.correct : t.wrong}
                      onClick={() => setSelected({ themeId: th.id, index: i })}
                    >
                      <span className="abacus-points">{p.points}</span>
                      {v && <span className="abacus-mark">{v.correct ? "✓" : "✗"}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="abacus-detail" data-testid="abx-my-detail">
            {!theme || !problem ? (
              <p className="muted">{t.pick}</p>
            ) : (
              <>
                <div className="abacus-detail-head">
                  <strong>
                    {pick(theme.title, lang)} · {problem.points}
                  </strong>
                  {(() => {
                    const v = selected ? verdictAt(mine, theme.id, selected.index) : undefined;
                    if (!v) return <span className="muted">{t.waiting}</span>;
                    return (
                      <span className={v.correct ? "bt-status-ok" : "result-bad"}>
                        {v.correct ? `✓ ${t.correct} · +${v.points}` : `✗ ${t.wrong}`}
                      </span>
                    );
                  })()}
                </div>
                {problem.statementHtml ? (
                  <div
                    className="statement"
                    dangerouslySetInnerHTML={{ __html: pick(problem.statementHtml, lang) }}
                  />
                ) : (
                  <p className="muted">—</p>
                )}
                {problem.href && <Link href={problem.href}>→</Link>}
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}
