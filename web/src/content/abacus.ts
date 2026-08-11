// The Math Abacus board — three age variants, their themes, costs and
// (eventually) statements.
//
// Everything a game consists of lives here, hardcoded like the other brain
// teasers, so the types catch a half-translated theme before it reaches a page.
// The boards are deliberately empty for now: the cells, the costs and the
// hand-in order are real, the statements are not written yet.

import { figure } from "@/content/figures.generated";

export type Lang = "ru" | "en";
export const LANGS: Lang[] = ["ru", "en"];

/** A string in both languages. Both are required — a missing one is a bug. */
export type Loc = Record<Lang, string>;

/** The three variants of the same game, one per age group. Ordered easiest
 *  first; this is the order of the tabs. */
export type Level = "hard" | "extreme" | "nightmare";
export const LEVELS: Level[] = ["hard", "extreme", "nightmare"];

export interface AbacusProblem {
  /** What the cell is worth. Rises across a theme: 10 → 20 → 30. */
  points: number;
  title?: Loc;
  /** Markdown; `$…$` and `$$…$$` are rendered with KaTeX. */
  statement?: Loc;
  /** Optional link to a site problem or notebook, e.g. /problems/py_basics/bin_basic. */
  href?: string;
}

export interface AbacusTheme {
  id: string;
  title: Loc;
  /** In hand-in order, cheapest first. */
  problems: AbacusProblem[];
}

export interface AbacusVariant {
  level: Level;
  /** Shown on the tab. Same word in both languages. */
  label: string;
  ages: Loc;
  themes: AbacusTheme[];
}

export interface AbacusGame {
  slug: string;
  title: Loc;
  intro: Loc;
  variants: AbacusVariant[];
}

// A filled-in cell looks like this — markdown, `$…$` inline and `$$…$$` display
// math, and an optional link to a task on the site:
//
//   {
//     points: 10,
//     href: "/problems/py_basics/bin_basic",
//     statement: {
//       ru: `В треугольнике $ABC$ угол $C$ прямой, $a = 3$ и $b = 4$.
//
//   Найдите радиус *вписанной* окружности: $$r = \\frac{a + b - c}{2}$$`,
//       en: `In triangle $ABC$ …`,
//     },
//   }
const EMPTY_3 = (): AbacusProblem[] => [{ points: 10 }, { points: 20 }, { points: 30 }];

/** Markdown paragraphs: blank line between, and an absent one drops out. */
const para = (...parts: Array<string | undefined>) => parts.filter(Boolean).join("\n\n");

/* Set for two age groups at once — same picture, same cost. The older ones are
 * additionally asked to justify the number, hence the extra paragraph. */
const tilesInABox = (extra?: Loc): AbacusProblem => ({
  points: 10,
  statement: {
    ru: para(
      "Какое максимальное число плиток $1\\times2\\times2$ можно положить в коробку $3\\times3\\times3$?",
      extra?.ru,
      figure("abacus/tiles-in-a-box"),
    ),
    en: para(
      "What is the largest number of $1\\times2\\times2$ tiles that fit into a $3\\times3\\times3$ box?",
      extra?.en,
      figure("abacus/tiles-in-a-box"),
    ),
  },
});

const PROVE_IT: Loc = {
  ru: "Приведите пример и докажите, что больше нельзя.",
  en: "Give an example, and prove that no more will fit.",
};

/** The placeholder 3×3 every variant starts as. Themes may differ per level —
 *  each variant owns its own list. */
const PLACEHOLDER_THEMES = (): AbacusTheme[] => [
  { id: "geometry", title: { ru: "Геометрия", en: "Geometry" }, problems: EMPTY_3() },
  {
    id: "combinatorics",
    title: { ru: "Комбинаторика", en: "Combinatorics" },
    problems: EMPTY_3(),
  },
  { id: "algebra", title: { ru: "Алгебра", en: "Algebra" }, problems: EMPTY_3() },
];

export const ABACUS: AbacusGame = {
  slug: "abacus",
  title: { ru: "Математическая абака", en: "Math Abacus" },
  intro: {
    ru: "Командное соревнование: 3 темы по 3 задачи. Внутри темы задачи сдаются по порядку — 10, 20, 30. Читать и решать можно любую, а сдать дорогую нельзя, пока не сданы все дешёвые. «Сдана» не значит «решена верно»: за задачу можно получить 0 и всё равно двигаться дальше.",
    en: "A team contest: 3 themes of 3 problems. Inside a theme the problems are handed in in order — 10, 20, 30. You may read and solve any of them, but a dearer one cannot be handed in until every cheaper one has been. Handed in does not mean solved: a problem can score 0 and still open the next.",
  },
  variants: [
    {
      level: "hard",
      label: "Hard",
      ages: { ru: "10–12 лет", en: "ages 10–12" },
      themes: [
        {
          id: "geometry",
          title: { ru: "Геометрия", en: "Geometry" },
          problems: [tilesInABox(), { points: 20 }, { points: 30 }],
        },
        {
          id: "combinatorics",
          title: { ru: "Комбинаторика", en: "Combinatorics" },
          problems: EMPTY_3(),
        },
        {
          id: "numbers",
          title: { ru: "Числа", en: "Numbers" },
          problems: [
            {
              points: 10,
              statement: {
                // Two different naturals — with the same one it would be
                // $a^2/a^3 = 1/a$, so the formula is what makes the sentence
                // unambiguous.
                ru: `Докажите, что любое натуральное число можно представить в виде отношения квадрата к кубу натурального числа:

$$n = \\frac{a^2}{b^3}, \\qquad a,\\, b \\in \\mathbb{N}.$$`,
                en: `Prove that every natural number can be written as the ratio of a square to a cube of natural numbers:

$$n = \\frac{a^2}{b^3}, \\qquad a,\\, b \\in \\mathbb{N}.$$`,
              },
            },
            { points: 20 },
            { points: 30 },
          ],
        },
      ],
    },
    {
      level: "extreme",
      label: "Extreme",
      ages: { ru: "13–15 лет", en: "ages 13–15" },
      themes: [
        {
          id: "geometry",
          title: { ru: "Геометрия", en: "Geometry" },
          problems: [tilesInABox(PROVE_IT), { points: 20 }, { points: 30 }],
        },
        {
          id: "combinatorics",
          title: { ru: "Комбинаторика", en: "Combinatorics" },
          problems: EMPTY_3(),
        },
        { id: "algebra", title: { ru: "Алгебра", en: "Algebra" }, problems: EMPTY_3() },
      ],
    },
    {
      level: "nightmare",
      label: "Nightmare",
      ages: { ru: "16 лет и старше", en: "ages 16+" },
      themes: PLACEHOLDER_THEMES(),
    },
  ],
};
