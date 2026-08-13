"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* End the event — joins and marking stop, the monitor keeps the final standings
 * on the wall. Re-openable, because "closed" gets pressed by accident. */
export function AbacusCloseButton({ code, closed }: { code: string; closed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: boolean) {
    if (busy) return;
    if (next && !window.confirm("Завершить игру? Новые команды и вердикты больше не принимаются.")) {
      return;
    }
    setBusy(true);
    await fetch(`/api/abacus/sessions/${encodeURIComponent(code)}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: next }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className="bt-clear-btn"
      data-testid="abx-close"
      disabled={busy}
      onClick={() => set(!closed)}
    >
      {busy ? "…" : closed ? "Возобновить" : "Завершить игру"}
    </button>
  );
}
