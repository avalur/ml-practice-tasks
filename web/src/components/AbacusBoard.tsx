"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cellKey, isLang, isLevel, isOpen, pick, totalProblems } from "@/lib/abacus";
import type { Lang, Level, RenderedGame } from "@/lib/abacus";
import { TeaserPublishToggle } from "@/components/TeaserPublishToggle";

const LANG_KEY = "mlp:abacus:lang";
const LEVEL_KEY = "mlp:abacus:level";
/** Progress is per level — three separate games, three separate boards. */
const progressKey = (level: Level) => `mlp:abacus:v1:${level}`;

const UI = {
  ru: {
    print: "Печать условий",
    handIn: "Сдать",
    undo: "Отменить сдачу",
    handedIn: "Сдана",
    locked: "Сначала сдайте задачи подешевле в этой теме",
    open: "Открыть условие",
    empty: "Условие ещё не добавлено.",
    goto: "Перейти к задаче →",
    progress: (n: number, total: number) => `Сдано ${n} из ${total}`,
    reset: "Сбросить",
    points: (n: number) => `${n} баллов`,
    pickCell: "Выберите клетку, чтобы прочитать условие.",
    draft: "Черновик: игру видите только вы. Нажмите Publish, чтобы открыть её всем.",
  },
  en: {
    print: "Print statements",
    handIn: "Hand in",
    undo: "Undo hand-in",
    handedIn: "Handed in",
    locked: "Hand in the cheaper problems of this theme first",
    open: "Open the statement",
    empty: "The statement is not written yet.",
    goto: "Go to the problem →",
    progress: (n: number, total: number) => `Handed in ${n} of ${total}`,
    reset: "Reset",
    points: (n: number) => `${n} points`,
    pickCell: "Pick a cell to read its statement.",
    draft: "Draft: nobody but you can see this game. Publish puts it on the site.",
  },
} satisfies Record<Lang, Record<string, unknown>>;

type Selection = { themeId: string; index: number };

export function AbacusBoard({
  game,
  admin,
  published,
}: {
  game: RenderedGame;
  admin: boolean;
  published: boolean;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [level, setLevel] = useState<Level>(game.variants[0].level);
  const [handedIn, setHandedIn] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<Selection | null>(null);
  // Nothing stored is applied until the browser has been read, so the first
  // client render matches the server's and hydration stays quiet.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const fromUrl = url.get("lang");
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(fromUrl)) setLang(fromUrl);
    else if (isLang(stored)) setLang(stored);

    const levelFromUrl = url.get("level");
    const storedLevel = localStorage.getItem(LEVEL_KEY);
    if (isLevel(levelFromUrl)) setLevel(levelFromUrl);
    else if (isLevel(storedLevel)) setLevel(storedLevel);

    setLoaded(true);
  }, []);

  // Progress belongs to a level, so it is re-read on every switch — including
  // the one the effect above may have made on load.
  useEffect(() => {
    if (!loaded) return;
    try {
      const raw = localStorage.getItem(progressKey(level));
      const keys: unknown = raw ? JSON.parse(raw) : [];
      setHandedIn(new Set(Array.isArray(keys) ? keys.filter((k) => typeof k === "string") : []));
    } catch {
      setHandedIn(new Set()); // a corrupted key is not worth a broken board
    }
    setSelected(null);
  }, [level, loaded]);

  function save(level: Level, next: ReadonlySet<string>) {
    localStorage.setItem(progressKey(level), JSON.stringify([...next]));
  }

  function chooseLang(next: Lang) {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  }

  function chooseLevel(next: Level) {
    setLevel(next);
    localStorage.setItem(LEVEL_KEY, next);
  }

  function toggleHandIn(themeId: string, index: number) {
    const key = cellKey(themeId, index);
    const next = new Set(handedIn);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHandedIn(next);
    save(level, next);
  }

  function reset() {
    setHandedIn(new Set());
    save(level, new Set());
    setSelected(null);
  }

  const t = UI[lang];
  const variant = game.variants.find((v) => v.level === level) ?? game.variants[0];
  const total = totalProblems(variant);
  const columns = Math.max(...variant.themes.map((th) => th.problems.length));

  const theme = variant.themes.find((th) => th.id === selected?.themeId);
  const problem = selected ? theme?.problems[selected.index] : undefined;
  const selKey = theme && selected ? cellKey(theme.id, selected.index) : "";
  const selDone = handedIn.has(selKey);
  // Undo is allowed only on the last handed-in cell of its theme; anything else
  // would leave a hole in an order the game says has none.
  const canUndo =
    selDone && !!theme && !!selected && !handedIn.has(cellKey(theme.id, selected.index + 1));

  return (
    <article className="bt-page abacus-page">
      <div className="abacus-head">
        <h1>{pick(game.title, lang)}</h1>
        <div className="abacus-head-actions no-print">
          {admin && (
            <>
              {!published && <span className="badge medium">draft</span>}
              <TeaserPublishToggle slug={game.slug} published={published} />
            </>
          )}
          <div className="abacus-lang" role="group" aria-label="Language">
            {(["ru", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`abacus-lang-btn${lang === l ? " is-active" : ""}`}
                aria-pressed={lang === l}
                onClick={() => chooseLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <Link
            className="bt-clear-btn"
            href={`/brainteasers/abacus/print?lang=${lang}&level=${level}`}
          >
            🖨 {t.print}
          </Link>
        </div>
      </div>

      {admin && !published && (
        <p className="class-draft-note" data-testid="abacus-draft-note">
          {t.draft}
        </p>
      )}

      <div className="abacus-levels" role="tablist" aria-label="Difficulty">
        {game.variants.map((v) => (
          <button
            key={v.level}
            type="button"
            role="tab"
            aria-selected={v.level === level}
            data-testid={`abacus-level-${v.level}`}
            className={`abacus-level${v.level === level ? " is-active" : ""}`}
            onClick={() => chooseLevel(v.level)}
          >
            <span className="abacus-level-name">{v.label}</span>
            <span className="abacus-level-ages">{pick(v.ages, lang)}</span>
          </button>
        ))}
      </div>

      <div className="bt-rules">{pick(game.intro, lang)}</div>

      <div
        className="abacus-grid"
        style={{ gridTemplateColumns: `minmax(7rem, 1fr) repeat(${columns}, minmax(0, 1fr))` }}
      >
        {variant.themes.map((th) => (
          <div key={th.id} className="abacus-row">
            <div className="abacus-theme">{pick(th.title, lang)}</div>
            {th.problems.map((p, i) => {
              const done = handedIn.has(cellKey(th.id, i));
              const open = isOpen(th.id, i, handedIn);
              const state = done ? "done" : open ? "open" : "locked";
              const isSelected = selected?.themeId === th.id && selected.index === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={`abacus-cell${isSelected ? " is-selected" : ""}`}
                  data-state={state}
                  data-testid={`abacus-cell-${th.id}-${i}`}
                  disabled={state === "locked"}
                  title={state === "locked" ? t.locked : t.open}
                  onClick={() => setSelected({ themeId: th.id, index: i })}
                >
                  <span className="abacus-points">{p.points}</span>
                  {state === "done" && <span className="abacus-mark">✓</span>}
                  {state === "locked" && <span className="abacus-mark">🔒</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="abacus-status">
        <span data-testid="abacus-progress">{t.progress(handedIn.size, total)}</span>
        {handedIn.size > 0 && (
          <button type="button" className="bt-clear-btn" onClick={reset}>
            {t.reset}
          </button>
        )}
      </div>

      <div className="abacus-detail" data-testid="abacus-detail">
        {!theme || !problem ? (
          <p className="muted">{t.pickCell}</p>
        ) : (
          <>
            <div className="abacus-detail-head">
              <strong>
                {pick(theme.title, lang)} · {t.points(problem.points)}
              </strong>
              {selDone && <span className="bt-status-ok">✓ {t.handedIn}</span>}
            </div>

            {problem.statementHtml ? (
              <div
                className="statement"
                dangerouslySetInnerHTML={{ __html: pick(problem.statementHtml, lang) }}
              />
            ) : (
              <p className="muted">{t.empty}</p>
            )}

            {problem.href && <Link href={problem.href}>{t.goto}</Link>}

            <div className="abacus-detail-actions">
              <button
                type="button"
                className="btn"
                data-testid="abacus-hand-in"
                onClick={() => selected && toggleHandIn(theme.id, selected.index)}
                disabled={selDone && !canUndo}
              >
                {selDone ? t.undo : t.handIn}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
