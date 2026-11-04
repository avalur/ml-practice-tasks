"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* One button that POSTs a JSON body and refreshes the page — every action in
 * the admin queues is that shape. `prompt` asks for a free-text field first
 * (sent as `promptField`); `confirm` asks a yes/no question. */
export function AdminAction({
  url,
  body,
  label,
  confirm,
  prompt,
  promptField = "note",
  danger,
  testId,
}: {
  url: string;
  body: Record<string, unknown>;
  label: string;
  confirm?: string;
  prompt?: string;
  promptField?: string;
  danger?: boolean;
  testId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    const payload = { ...body };
    if (prompt) {
      const typed = window.prompt(prompt);
      if (typed === null) return;
      payload[promptField] = typed;
    } else if (confirm && !window.confirm(confirm)) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Request failed.");
      else router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`bt-clear-btn${danger ? " danger" : ""}`}
        disabled={busy}
        onClick={run}
        data-testid={testId}
      >
        {busy ? "…" : label}
      </button>
      {err && <span className="class-join-err">{err}</span>}
    </>
  );
}
