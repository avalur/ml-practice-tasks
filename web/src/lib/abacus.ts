// Client-safe half of the abacus: types and the rules. Nothing here imports
// marked or katex — that lives in abacus-render.ts, which only servers call, so
// neither library is dragged into the board's browser bundle.

import { LEVELS, type Lang, type Level, type Loc } from "@/content/abacus";

export type {
  AbacusGame,
  AbacusProblem,
  AbacusTheme,
  AbacusVariant,
  Lang,
  Level,
  Loc,
} from "@/content/abacus";

/** A problem with both statements already turned into HTML on the server. */
export interface RenderedProblem {
  points: number;
  href?: string;
  title?: Loc;
  /** Absent while the statement is still unwritten. */
  statementHtml?: Loc;
}

export interface RenderedTheme {
  id: string;
  title: Loc;
  problems: RenderedProblem[];
}

export interface RenderedVariant {
  level: Level;
  label: string;
  ages: Loc;
  themes: RenderedTheme[];
}

export interface RenderedGame {
  slug: string;
  title: Loc;
  intro: Loc;
  variants: RenderedVariant[];
}

export function pick(loc: Loc, lang: Lang): string {
  return loc[lang];
}

export function isLang(v: unknown): v is Lang {
  return v === "ru" || v === "en";
}

export function isLevel(v: unknown): v is Level {
  return (LEVELS as string[]).includes(v as string);
}

/** Identifies one cell in the stored progress. Position, not points, because
 *  re-pricing a theme should not silently reset which cells were handed in. */
export function cellKey(themeId: string, index: number): string {
  return `${themeId}#${index}`;
}

/** The whole rule of the game: a cell opens once every cheaper problem in its
 *  own theme has been handed in — handed in, not solved. */
export function isOpen(
  themeId: string,
  index: number,
  handedIn: ReadonlySet<string>,
): boolean {
  for (let i = 0; i < index; i++) {
    if (!handedIn.has(cellKey(themeId, i))) return false;
  }
  return true;
}

export function totalProblems(variant: { themes: { problems: unknown[] }[] }): number {
  return variant.themes.reduce((n, t) => n + t.problems.length, 0);
}

// ── live sessions ────────────────────────────────────────────────────────────
//
// Shared by the monitor, the team's screen and the jury's grid, so the shapes
// and the rule live on this (client-safe) side; the database and the cookie are
// in lib/abacus-session.ts.

export type VerdictDTO = {
  themeId: string;
  index: number;
  correct: boolean;
  /** What the cell was worth when it was ruled — a snapshot, not a lookup. */
  points: number;
};

export type TeamDTO = {
  id: string;
  name: string;
  level: Level;
  score: number;
  verdicts: VerdictDTO[];
};

export type BoardDTO = {
  code: string;
  title: string | null;
  closed: boolean;
  /** Server clock, so a screen can say "as of …" without trusting its own. */
  now: string;
  teams: TeamDTO[];
};

/** The game's rule, in the one place both the grid and the API ask about it: a
 *  verdict goes on the cheapest un-ruled cell of a theme, and only the dearest
 *  ruled one can be taken back. */
export function markable(
  verdicts: readonly VerdictDTO[],
  themeId: string,
  cells: number,
): { next: number | null; undo: number | null } {
  const ruled = new Set(verdicts.filter((v) => v.themeId === themeId).map((v) => v.index));
  let next: number | null = null;
  for (let i = 0; i < cells; i++) {
    if (!ruled.has(i)) {
      next = i;
      break;
    }
  }
  let undo: number | null = null;
  for (let i = cells - 1; i >= 0; i--) {
    if (ruled.has(i)) {
      undo = i;
      break;
    }
  }
  return { next, undo };
}

export function verdictAt(
  verdicts: readonly VerdictDTO[],
  themeId: string,
  index: number,
): VerdictDTO | undefined {
  return verdicts.find((v) => v.themeId === themeId && v.index === index);
}

export function scoreOf(verdicts: readonly VerdictDTO[]): number {
  return verdicts.reduce((sum, v) => sum + (v.correct ? v.points : 0), 0);
}
