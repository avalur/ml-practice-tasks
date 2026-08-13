"use client";

import { useState } from "react";

import {
  markable,
  verdictAt,
  type BoardDTO,
  type Level,
  type TeamDTO,
  type VerdictDTO,
} from "@/lib/abacus";
import { useAbacusBoard } from "@/components/useAbacusBoard";
import type { MonitorTheme } from "@/components/AbacusMonitor";

/* The jury's page: every team, every cell, two buttons.
 *
 * Only the cheapest un-ruled cell of a theme can be ruled on, and only the last
 * verdict can be taken back — the same rule the API enforces, drawn here so it
 * reads as the game rather than as a refusal. */

const cellKey = (teamId: string, themeId: string, index: number) =>
  `${teamId}|${themeId}|${index}`;

/* What this screen knows it wrote, laid over whatever the poll last brought.
 *
 * The board is read over the network from a pooled connection, so a poll that
 * left before a verdict was recorded can arrive after it carrying data from
 * before it — a read's data can be older than the read itself, which is why a
 * timestamp cannot settle this on its own. A verdict blinking out from under the
 * jury's hand is the one thing this page must never do, so a patch stays until a
 * polled board says the same thing. */
type Patch = { verdict: VerdictDTO | null };

function merge(board: BoardDTO, patches: Map<string, Patch>): BoardDTO {
  if (patches.size === 0) return board;
  const teams: TeamDTO[] = board.teams.map((team) => {
    let verdicts = team.verdicts;
    for (const [key, patch] of patches) {
      const [teamId, themeId, rawIndex] = key.split("|");
      if (teamId !== team.id) continue;
      const index = Number(rawIndex);
      verdicts = verdicts.filter((v) => !(v.themeId === themeId && v.index === index));
      if (patch.verdict) verdicts = [...verdicts, patch.verdict];
    }
    if (verdicts === team.verdicts) return team;
    return {
      ...team,
      verdicts,
      score: verdicts.reduce((sum, v) => sum + (v.correct ? v.points : 0), 0),
    };
  });
  return { ...board, teams };
}

/** Patches the server's board already agrees with — nothing left to hold. */
function settledKeys(polled: BoardDTO, patches: Map<string, Patch>): string[] {
  const done: string[] = [];
  for (const [key, patch] of patches) {
    const [teamId, themeId, rawIndex] = key.split("|");
    const team = polled.teams.find((t) => t.id === teamId);
    if (!team) {
      done.push(key); // the team is gone; so is the patch
      continue;
    }
    const live = verdictAt(team.verdicts, themeId, Number(rawIndex));
    const agrees = patch.verdict ? live?.correct === patch.verdict.correct : !live;
    if (agrees) done.push(key);
  }
  return done;
}

export function AbacusMarkGrid({
  code,
  initial,
  themes,
}: {
  code: string;
  initial: BoardDTO;
  themes: Record<Level, MonitorTheme[]>;
}) {
  const { board: polled, refresh } = useAbacusBoard(code, initial);
  // A set, not one key: two cells can legitimately be in flight at once.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [patches, setPatches] = useState<Map<string, Patch>>(new Map());
  const [err, setErr] = useState<string | null>(null);

  const settled = settledKeys(polled, patches);
  if (settled.length > 0) {
    // Rendering-time reconciliation: cheaper than an effect, and the next render
    // is immediate because setState during render is queued, not looped.
    setPatches((prev) => {
      const next = new Map(prev);
      for (const key of settled) next.delete(key);
      return next;
    });
  }
  const board = merge(polled, patches);

  async function rule(
    teamId: string,
    themeId: string,
    index: number,
    points: number,
    body: { correct: boolean } | { clear: true },
  ) {
    const key = cellKey(teamId, themeId, index);
    // Per cell, not global: a jury clicks fast, and blocking every button while
    // one request is in flight dropped those clicks on the floor without a word.
    if (busy.has(key)) return;
    setBusy((prev) => new Set(prev).add(key));
    setErr(null);
    try {
      const res = await fetch(`/api/abacus/sessions/${encodeURIComponent(code)}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, themeId, index, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Не получилось.");
        await refresh(); // somebody else may have moved the board on
      } else {
        setPatches((prev) =>
          new Map(prev).set(key, {
            verdict:
              "clear" in body ? null : { themeId, index, correct: body.correct, points },
          }),
        );
      }
    } catch {
      setErr("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function removeTeam(teamId: string, name: string) {
    if (!window.confirm(`Удалить команду «${name}»? Её вердикты тоже исчезнут.`)) return;
    await fetch(`/api/abacus/sessions/${encodeURIComponent(code)}/teams/${teamId}`, {
      method: "DELETE",
    });
    await refresh();
  }

  if (board.teams.length === 0) {
    return (
      <p className="muted">
        Ни одной команды. Дайте код <strong>{board.code}</strong> и ссылку{" "}
        <strong>/brainteasers/abacus/join</strong>.
      </p>
    );
  }

  return (
    <div className="abx-mark" data-testid="abx-mark">
      {err && <p className="class-join-err">{err}</p>}
      {board.teams.map((team) => (
        <section key={team.id} className="abx-mark-team">
          <header className="abx-mark-head">
            <strong>{team.name}</strong>
            <span className="badge medium">{team.level}</span>
            <span className="abx-mark-score" data-testid={`abx-mark-score-${team.name}`}>
              {team.score}
            </span>
            <button
              type="button"
              className="bt-clear-btn"
              onClick={() => removeTeam(team.id, team.name)}
            >
              Удалить
            </button>
          </header>

          {themes[team.level].map((theme) => {
            const { next, undo } = markable(team.verdicts, theme.id, theme.points.length);
            return (
              <div key={theme.id} className="abx-mark-row">
                <span className="abx-mark-theme">{theme.titleRu}</span>
                {theme.points.map((points, i) => {
                  const v = verdictAt(team.verdicts, theme.id, i);
                  const key = cellKey(team.id, theme.id, i);
                  const isNext = next === i && !board.closed;
                  return (
                    <span
                      key={i}
                      className="abx-mark-cell"
                      data-state={!v ? (isNext ? "next" : "later") : v.correct ? "ok" : "bad"}
                      data-testid={`abx-mark-${team.name}-${theme.id}-${i}`}
                    >
                      <span className="abx-mark-points">{points}</span>
                      {v ? (
                        <>
                          <span className="abx-mark-verdict">{v.correct ? "✓" : "✗"}</span>
                          {undo === i && !board.closed && (
                            <button
                              type="button"
                              className="abx-mark-btn"
                              title="Отменить вердикт"
                              data-testid={`abx-undo-${team.name}-${theme.id}-${i}`}
                              disabled={busy.has(key)}
                              onClick={() => rule(team.id, theme.id, i, points, { clear: true })}
                            >
                              ↶
                            </button>
                          )}
                        </>
                      ) : isNext ? (
                        <>
                          <button
                            type="button"
                            className="abx-mark-btn is-ok"
                            title="Верно"
                            data-testid={`abx-ok-${team.name}-${theme.id}-${i}`}
                            disabled={busy.has(key)}
                            onClick={() => rule(team.id, theme.id, i, points, { correct: true })}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="abx-mark-btn is-bad"
                            title="Неверно"
                            data-testid={`abx-bad-${team.name}-${theme.id}-${i}`}
                            disabled={busy.has(key)}
                            onClick={() => rule(team.id, theme.id, i, points, { correct: false })}
                          >
                            ✗
                          </button>
                        </>
                      ) : (
                        <span className="abx-mark-wait">·</span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
