"use client";

import { useState } from "react";
import Link from "next/link";

import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason } from "@/lib/teacher-shared";

/* "Report this class" — the visitor's half of moderation on an open platform.
 * A quiet link that unfolds into a short form; signed-out visitors are sent to
 * sign in first, because a report needs somebody behind it. */
export function ReportClassButton({
  slug,
  lesson,
  signedIn,
}: {
  slug: string;
  lesson?: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const here = lesson ? `/classes/${slug}/lessons/${lesson}` : `/classes/${slug}`;

  if (!signedIn) {
    return (
      <p className="report-class muted">
        Something wrong with this class?{" "}
        <Link href={`/signin?next=${encodeURIComponent(here)}`}>Sign in to report it</Link>.
      </p>
    );
  }

  if (msg?.kind === "ok") {
    return (
      <p className="report-class class-join-ok" data-testid="report-sent">
        {msg.text}
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/classes/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details, lesson }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ kind: "ok", text: "Thank you — the site admins will look at it." });
      } else {
        setMsg({ kind: "err", text: data.error ?? "Could not send the report." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error — try again." });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <p className="report-class">
        <button type="button" className="link-btn muted" onClick={() => setOpen(true)} data-testid="report-open">
          Report this class
        </button>
      </p>
    );
  }

  return (
    <form className="report-class report-form" onSubmit={submit} data-testid="report-form">
      <p className="muted">What is wrong? The report goes to the site admins, not to the teacher.</p>
      {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
        <label key={r} className="report-reason">
          <input
            type="radio"
            name="reason"
            value={r}
            checked={reason === r}
            onChange={() => setReason(r)}
          />{" "}
          {REPORT_REASONS[r]}
        </label>
      ))}
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Where is it, and what exactly is the problem?"
        maxLength={REPORT_DETAILS_MAX}
        rows={4}
        aria-label="Details"
      />
      <div className="report-actions">
        <button
          type="submit"
          className="bt-clear-btn"
          disabled={busy || !reason || details.trim().length < 10}
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" className="link-btn muted" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg && <p className="class-join-err">{msg.text}</p>}
    </form>
  );
}
