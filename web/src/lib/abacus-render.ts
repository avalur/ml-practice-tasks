// Server-side statement rendering for the abacus. Both the board and the print
// sheet get finished HTML, so marked and katex stay out of the browser bundle.

import { marked } from "marked";
import katex from "katex";

import { LANGS, type AbacusGame, type Lang, type Loc } from "@/content/abacus";
import type { RenderedGame } from "@/lib/abacus";

// $$…$$ first, then $…$ on a single line. A lone $ (a price, say) is left alone.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/** Markdown + KaTeX. Math is lifted out before marked runs and put back after,
 *  because markdown would otherwise eat the `_` and `*` inside a formula. */
export async function renderStatement(md: string): Promise<string> {
  const math: string[] = [];
  const masked = md.replace(MATH_RE, (_m, block: string | undefined, inline: string) => {
    const html = katex.renderToString((block ?? inline).trim(), {
      displayMode: block !== undefined,
      throwOnError: false,
    });
    return `@@MATH${math.push(html) - 1}@@`;
  });
  const parsed = await marked.parse(masked);
  return parsed.replace(/@@MATH(\d+)@@/g, (_m, i: string) => math[Number(i)] ?? "");
}

async function renderLoc(loc: Loc): Promise<Loc> {
  const parts = await Promise.all(LANGS.map((l: Lang) => renderStatement(loc[l])));
  return Object.fromEntries(LANGS.map((l, i) => [l, parts[i]])) as Loc;
}

export async function renderGame(game: AbacusGame): Promise<RenderedGame> {
  return {
    slug: game.slug,
    title: game.title,
    intro: game.intro,
    variants: await Promise.all(
      game.variants.map(async (variant) => ({
        level: variant.level,
        label: variant.label,
        ages: variant.ages,
        themes: await Promise.all(
          variant.themes.map(async (theme) => ({
            id: theme.id,
            title: theme.title,
            problems: await Promise.all(
              theme.problems.map(async (p) => ({
                points: p.points,
                ...(p.href ? { href: p.href } : {}),
                ...(p.title ? { title: p.title } : {}),
                ...(p.statement ? { statementHtml: await renderLoc(p.statement) } : {}),
              })),
            ),
          })),
        ),
      })),
    ),
  };
}
