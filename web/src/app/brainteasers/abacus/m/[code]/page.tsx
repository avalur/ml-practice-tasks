import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import { LEVELS } from "@/content/abacus";
import type { Level } from "@/lib/abacus";
import { readBoard, sessionByCode, themesOf } from "@/lib/abacus-session";
import { AbacusMonitor, type MonitorTheme } from "@/components/AbacusMonitor";

export const metadata: Metadata = {
  title: "Абака — монитор",
  robots: { index: false },
};

/* The projector. Public by code — anyone in the room can open it, and a team
 * name is all it carries. Not gated on the teaser being published: an event can
 * run before the practice board goes on the site. */
export default async function AbacusMonitorPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await sessionByCode(code);
  if (!session) notFound();

  const board = await readBoard(session.id, session.code, session.title, session.closedAt);
  const themes = Object.fromEntries(
    LEVELS.map((l) => [l, themesOf(l)]),
  ) as Record<Level, MonitorTheme[]>;

  return (
    <article className="abx-monitor-page">
      <AbacusMonitor code={session.code} initial={board} themes={themes} />
    </article>
  );
}
