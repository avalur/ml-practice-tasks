import type { Metadata } from "next";

import { AbacusJoinForm } from "@/components/AbacusJoinForm";

export const metadata: Metadata = {
  title: "Математическая абака — вход в игру",
  description: "Enter the game code your teacher gave you.",
  robots: { index: false },
};

/* The one page a team meets before anything else, so it says nothing but what to
 * do. Reachable whether or not the abacus itself is published: the code is the
 * invitation. */
export default async function AbacusJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return (
    <article className="bt-page">
      <h1>Абака · вход</h1>
      <p className="muted">
        Введите код игры, придумайте название команды и выберите уровень. Аккаунт не
        нужен. · Enter the game code, name your team, pick a level. No account needed.
      </p>
      <AbacusJoinForm initialCode={code} />
    </article>
  );
}
