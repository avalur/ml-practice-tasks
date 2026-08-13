import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LEVELS } from "@/content/abacus";
import type { Level } from "@/lib/abacus";
import { isSiteAdmin } from "@/lib/admin";
import { readBoard, sessionByCode, themesOf } from "@/lib/abacus-session";
import { AbacusMarkGrid } from "@/components/AbacusMarkGrid";
import { AbacusCloseButton } from "@/components/AbacusCloseButton";
import type { MonitorTheme } from "@/components/AbacusMonitor";
import { PopOutButton } from "@/components/PopOutButton";

export const metadata: Metadata = {
  title: "Абака — судейская",
  robots: { index: false },
};

/* The jury's page. Editors only — it is the only place verdicts come from. */
export default async function AbacusJuryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!(await isSiteAdmin())) notFound();

  const session = await sessionByCode(code);
  if (!session) notFound();

  const board = await readBoard(session.id, session.code, session.title, session.closedAt);
  const themes = Object.fromEntries(LEVELS.map((l) => [l, themesOf(l)])) as Record<
    Level,
    MonitorTheme[]
  >;

  return (
    <article className="bt-page abacus-page">
      <p className="muted class-breadcrumb">
        <Link href="/brainteasers/abacus">Math Abacus</Link> › судейская
      </p>
      <div className="abacus-head">
        <h1>{session.title ?? "Абака"}</h1>
        <div className="abacus-head-actions">
          <AbacusCloseButton code={session.code} closed={session.closedAt !== null} />
          <PopOutButton url={`/brainteasers/abacus/m/${session.code}`} />
        </div>
      </div>

      <p className="abx-dictate">
        Код: <span className="abx-code">{session.code}</span>
      </p>
      <p className="muted">
        Команды вводят его на <strong>/brainteasers/abacus/join</strong>. Монитор для
        проектора: <Link href={`/brainteasers/abacus/m/${session.code}`}>/m/{session.code}</Link> —
        он публичный, ссылку можно дать всем.
      </p>

      <AbacusMarkGrid code={session.code} initial={board} themes={themes} />
    </article>
  );
}
