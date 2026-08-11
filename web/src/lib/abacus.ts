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
