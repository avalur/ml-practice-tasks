import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import { ABACUS, type Lang } from "@/content/abacus";
import { isLang, pick } from "@/lib/abacus";
import { renderGame } from "@/lib/abacus-render";
import { teaserAccess } from "@/lib/teasers";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = {
  title: "Math Abacus — statements",
  description: "All statements of the abacus game, laid out for printing.",
};

const SHEET = {
  ru: {
    print: "Печать",
    back: "← К полю",
    empty: "Условие ещё не добавлено.",
    points: (n: number) => `${n} баллов`,
    hint: "Печать → «Сохранить как PDF».",
  },
  en: {
    print: "Print",
    back: "← Back to the board",
    empty: "The statement is not written yet.",
    points: (n: number) => `${n} points`,
    hint: "Print → “Save as PDF”.",
  },
} satisfies Record<Lang, unknown>;

/** `?lang=ru`, `?lang=en`, or `?lang=both` for a bilingual round. */
function wanted(raw: string | undefined): Lang[] {
  if (raw === "both") return ["ru", "en"];
  return isLang(raw) ? [raw] : ["en"];
}

export default async function AbacusPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; level?: string }>;
}) {
  const { lang, level } = await searchParams;
  const langs = wanted(lang);
  const t = SHEET[langs[0]];

  const access = await teaserAccess(ABACUS.slug);
  if (!access.visible) notFound();

  const game = await renderGame(ABACUS);
  const variant = game.variants.find((v) => v.level === level) ?? game.variants[0];

  return (
    <article className="abacus-print">
      <div className="abacus-head">
        {/* The title is part of the sheet; only the buttons are chrome. */}
        <h1>
          {langs.map((l) => pick(game.title, l)).join(" / ")}
          {" · "}
          {variant.label}
        </h1>
        <div className="abacus-head-actions no-print">
          <Link className="bt-clear-btn" href="/brainteasers/abacus">
            {t.back}
          </Link>
          <PrintButton label={t.print} />
        </div>
      </div>

      <p className="abacus-print-ages">{langs.map((l) => pick(variant.ages, l)).join(" · ")}</p>
      <p className="muted no-print">{t.hint}</p>

      {variant.themes.map((theme) => (
        <section key={theme.id} className="abacus-print-theme">
          <h2>{langs.map((l) => pick(theme.title, l)).join(" / ")}</h2>
          {theme.problems.map((p, i) => (
            <div key={i} className="abacus-print-problem">
              <div className="abacus-print-points">{p.points}</div>
              <div className="abacus-print-body">
                {langs.map((l) => (
                  <div key={l}>
                    {langs.length > 1 && <div className="abacus-print-lang">{l.toUpperCase()}</div>}
                    {p.statementHtml ? (
                      <div
                        className="statement"
                        dangerouslySetInnerHTML={{ __html: pick(p.statementHtml, l) }}
                      />
                    ) : (
                      <p className="muted">{SHEET[l].empty}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
