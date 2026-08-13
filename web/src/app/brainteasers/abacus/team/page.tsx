import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";

import { ABACUS, LEVELS } from "@/content/abacus";
import { isLevel, type Level } from "@/lib/abacus";
import { renderGame } from "@/lib/abacus-render";
import { currentTeam, readBoard, themesOf } from "@/lib/abacus-session";
import { AbacusTeamBoard } from "@/components/AbacusTeamBoard";
import type { MonitorTheme } from "@/components/AbacusMonitor";

export const metadata: Metadata = {
  title: "Абака — доска команды",
  robots: { index: false },
};

/* A team's own screen. The cookie set at join is the whole identity, so there is
 * nothing to look up by hand and nothing to sign into. */
export default async function AbacusTeamPage() {
  const team = await currentTeam();
  if (!team) {
    return (
      <article className="bt-page">
        <h1>Абака</h1>
        <p className="muted">
          Этот браузер ни за одну команду не зарегистрирован. Введите код игры —
          и вперёд. · This browser is not registered for a team yet.
        </p>
        <Link className="btn primary" href="/brainteasers/abacus/join">
          Ввести код · Enter a code
        </Link>
      </article>
    );
  }

  const level: Level = isLevel(team.level) ? team.level : "hard";
  const game = await renderGame(ABACUS);
  const variant = game.variants.find((v) => v.level === level) ?? game.variants[0];
  const board = await readBoard(
    team.session.id,
    team.session.code,
    team.session.title,
    team.session.closedAt,
  );
  const themes = Object.fromEntries(LEVELS.map((l) => [l, themesOf(l)])) as Record<
    Level,
    MonitorTheme[]
  >;

  return (
    <AbacusTeamBoard
      code={team.session.code}
      teamId={team.id}
      variant={variant}
      initial={board}
      themes={themes}
    />
  );
}
