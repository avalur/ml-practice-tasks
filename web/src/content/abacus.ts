// The Math Abacus board — three age variants, their themes, costs and
// statements.
//
// Everything a game consists of lives here, hardcoded like the other brain
// teasers, so the types catch a half-translated theme before it reaches a page.
// Cells with no statement yet are real cells: they take part in the hand-in
// order and print as "not written yet".

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

// ── writing the problems ─────────────────────────────────────────────────────
//
// A statement is markdown: `$…$` and `$$…$$` are KaTeX, and a drawing goes in as
// `figure("abacus/<name>")` — see tools/build_figures.py. A problem shared by
// two age groups is a function taking the paragraph the older group gets extra,
// so the common text stays in one place.

const empty = (points: number): AbacusProblem => ({ points });

/** Markdown paragraphs: blank line between, and an absent one drops out. */
const para = (...parts: Array<string | undefined>) => parts.filter(Boolean).join("\n\n");

const theme = (id: string, ru: string, en: string, problems: AbacusProblem[]): AbacusTheme => ({
  id,
  title: { ru, en },
  problems,
});

/* Set for two age groups at once — same picture, same cost. The older ones are
 * additionally asked to justify the number, hence the extra paragraph. */
const tilesInABox = (points: number, extra?: Loc): AbacusProblem => ({
  points,
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

/* Also two age groups, and this drawing has words in it — hence one figure per
 * language (see tools/build_figures.py). */
const ropeInThePit = (points: number, extra?: Loc): AbacusProblem => ({
  points,
  statement: {
    ru: para(
      "Пусть имеется яма глубиной 1 км, верёвка длиной 900 м и нож. Верёвку можно закрепить вверху ямы и посередине (в точке на глубине 500 м). Как можно спуститься в яму, не пострадав?",
      extra?.ru,
      figure("abacus/rope-in-the-pit.ru"),
    ),
    en: para(
      "There is a pit 1 km deep, a rope 900 m long and a knife. The rope can be fastened at the top of the pit and at its middle — a point 500 m down. How can you get to the bottom unharmed?",
      extra?.en,
      figure("abacus/rope-in-the-pit.en"),
    ),
  },
});

const SHORTEST_ROPE: Loc = {
  ru: "При какой наименьшей длине верёвки это можно сделать?",
  en: "And what is the shortest rope that would still do?",
};

/* The pursuit on a graph. The oldest group gets the same question on a cube. */
const zooPaths = (points: number, extra?: Loc): AbacusProblem => ({
  points,
  statement: {
    ru: para(
      "Дорожки зоопарка представляют собой квадрат с проведёнными в нём средними линиями. По ним ходят два служащих зоопарка со скоростями $V_0$ и сбежавшая мартышка, скорость которой $3V_0$. Могут ли служащие гарантированно поймать мартышку?",
      extra?.ru,
    ),
    en: para(
      "The paths of a zoo form a square with both of its midlines drawn. Two keepers walk along them at speed $V_0$; an escaped monkey moves at $3V_0$. Can the keepers be sure to catch it?",
      extra?.en,
    ),
  },
});

const ON_A_CUBE: Loc = {
  ru: "Решите эту же задачу для куба $2\\times2\\times2$ (дорожки — это по-прежнему средние линии и стороны граней).",
  en: "Then solve the same problem on a $2\\times2\\times2$ cube, where the paths are again the midlines and the edges of its faces.",
};

/* The same for both age groups that get it — no extra paragraph. */
const antsOnAStick = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Дана палка длиной 1 м и 100 одинаковых муравьёв, бегающих со скоростями 10 см/с. Петя рассаживает одновременно всех муравьёв на палку (то есть задаёт положение и направление движения — вперёд или назад), и они начинают двигаться. Если муравьи сталкиваются друг с другом, то они меняют скорости на противоположные, а если добегают до конца палки, то просто падают вниз. Какое максимальное время хотя бы один муравей может оставаться на палке?",
    en: "A stick 1 m long carries 100 identical ants, each moving at 10 cm/s. Petya seats them all on the stick at once — that is, he sets every ant's position and its direction, forward or backward — and they start moving. When two ants meet, both reverse their velocities; when an ant reaches an end of the stick, it simply falls off. What is the longest time at least one ant can stay on the stick?",
  },
});

const sameNumberOfFriends = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Докажите, что в вашем классе найдутся два человека, имеющие одинаковое число друзей в вашем классе.",
    en: "Prove that in your class there are two people with the same number of friends in that class.",
  },
});

const nutsAndFloors = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: para(
      "У обезьяны есть 2 ореха и 15-этажный дом. Обезьяна может бросать орех с любого этажа и смотреть, разбивается орех (и тогда он потерян) или нет. Может ли она за 5 попыток определить минимальный этаж, при падении с которого орех разбивается?",
      figure("abacus/nuts-and-floors"),
    ),
    en: para(
      "A monkey has 2 nuts and a 15-storey building. It may drop a nut from any floor and see whether the nut breaks — in which case that nut is gone — or not. Can it find the lowest floor a nut breaks from in 5 drops?",
      figure("abacus/nuts-and-floors"),
    ),
  },
});

const dwarvesAndHats = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Однажды вечером людоед поймал 10 гномов и предложил им такую игру: на следующее утро он наденет на каждого из гномов белый или чёрный колпак и выстроит их в колонну друг за другом, так что первый стоящий будет видеть 9 остальных, второй — восьмерых, …, последний уже никого не будет видеть перед собой. После этого гномы по очереди, начиная с первого, должны будут сказать одно из слов «белый» либо «чёрный». Если гном угадывает цвет своего колпака, то людоед его отпускает, если нет — съедает. Сколько гномов могут гарантированно выжить в этой смертельной игре?",
    en: "One evening an ogre caught 10 dwarves and offered them a game: next morning he will put a white or a black cap on each of them and line them up in a column, one behind another, so that the first one sees the other nine, the second sees eight, …, and the last one sees nobody in front of him. Then, in that order and starting with the first, each dwarf must say one of two words, “white” or “black”. A dwarf who names the colour of his own cap is let go; one who does not is eaten. How many dwarves can be sure to survive this deadly game?",
  },
});

const surgeonsAndGloves = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Имеется 4 хирурга и 4 пары перчаток. Как может каждый хирург сделать операции каждому из остальных так, чтобы ни один из них ничем новым не заразился (предполагается, что каждый чем-то болеет и передаёт микробов через кровь и руки)?",
    en: "There are 4 surgeons and 4 pairs of gloves. How can every surgeon operate on each of the others so that none of them catches anything new? Assume each of them carries some illness and passes germs on through blood and through hands.",
  },
});

const whichIsLarger = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Что больше: $127^7$ или $33^{10}$?",
    en: "Which is larger, $127^7$ or $33^{10}$?",
  },
});

const twelveCoins = (points: number): AbacusProblem => ({
  points,
  statement: {
    ru: "Есть 12 одинаковых монеток, одна из которых фальшивая (она отличается по весу от остальных, но неизвестно, легче она или тяжелее). Как определить фальшивую монету за три взвешивания на чашечных весах?",
    en: "There are 12 identical-looking coins, one of them counterfeit: it differs in weight from the rest, but whether it is lighter or heavier is unknown. How can the counterfeit be found in three weighings on a balance scale?",
  },
});

const SQUARE_OVER_CUBE: AbacusProblem = {
  points: 10,
  statement: {
    // Two different naturals — with the same one it would be $a^2/a^3 = 1/a$,
    // so the formula is what makes the sentence unambiguous.
    ru: `Докажите, что любое натуральное число можно представить в виде отношения квадрата к кубу натурального числа:

$$n = \\frac{a^2}{b^3}, \\qquad a,\\, b \\in \\mathbb{N}.$$`,
    en: `Prove that every natural number can be written as the ratio of a square to a cube of natural numbers:

$$n = \\frac{a^2}{b^3}, \\qquad a,\\, b \\in \\mathbb{N}.$$`,
  },
};

// ── the boards ───────────────────────────────────────────────────────────────

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
        theme("geometry", "Геометрия", "Geometry", [
          tilesInABox(10),
          empty(20),
          ropeInThePit(30),
        ]),
        theme("combinatorics", "Комбинаторика", "Combinatorics", [
          sameNumberOfFriends(10),
          nutsAndFloors(20),
          empty(30),
        ]),
        theme("numbers", "Числа", "Numbers", [SQUARE_OVER_CUBE, empty(20), empty(30)]),
      ],
    },
    {
      level: "extreme",
      label: "Extreme",
      ages: { ru: "13–15 лет", en: "ages 13–15" },
      themes: [
        theme("geometry", "Геометрия", "Geometry", [
          tilesInABox(10, PROVE_IT),
          zooPaths(20),
          ropeInThePit(30, SHORTEST_ROPE),
        ]),
        theme("combinatorics", "Комбинаторика", "Combinatorics", [
          antsOnAStick(10),
          nutsAndFloors(20),
          dwarvesAndHats(30),
        ]),
        theme("algebra", "Алгебра", "Algebra", [
          whichIsLarger(10),
          empty(20),
          twelveCoins(30),
        ]),
      ],
    },
    {
      level: "nightmare",
      label: "Nightmare",
      ages: { ru: "16 лет и старше", en: "ages 16+" },
      themes: [
        theme("geometry", "Геометрия", "Geometry", [
          ropeInThePit(10, SHORTEST_ROPE),
          zooPaths(20, ON_A_CUBE),
          empty(30),
        ]),
        theme("combinatorics", "Комбинаторика", "Combinatorics", [
          antsOnAStick(10),
          dwarvesAndHats(20),
          surgeonsAndGloves(30),
        ]),
        theme("algebra", "Алгебра", "Algebra", [
          whichIsLarger(10),
          empty(20),
          twelveCoins(30),
        ]),
      ],
    },
  ],
};
