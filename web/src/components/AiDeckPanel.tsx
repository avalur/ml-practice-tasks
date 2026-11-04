"use client";

import { useState } from "react";
import Link from "next/link";

/* "Write slides with AI" above the deck editor. The answer replaces what the
 * editor shows but is not saved — the teacher reads it first, and can step back
 * to the previous text with one click. */
export function AiDeckPanel({
  courseSlug,
  lessonSlug,
  lessonTitle,
  currentDeck,
  onDeck,
}: {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  courseTitle: string;
  currentDeck: string;
  onDeck: (deck: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [slides, setSlides] = useState(10);
  const [language, setLanguage] = useState("English");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: courseSlug, lesson: lessonSlug, mode, prompt, slides, language, deck: currentDeck }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "The request failed." });
      } else {
        setPrevious(currentDeck);
        onDeck(data.deck);
        setMsg({
          ok: true,
          text:
            `Done with ${data.via}. Read it through, then Save slides.` +
            (data.remaining !== null && data.remaining !== undefined ? ` ${data.remaining} free requests left today.` : ""),
        });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — try again." });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <p>
        <button type="button" className="bt-clear-btn" onClick={() => setOpen(true)} data-testid="ai-open">
          ✨ Write slides with AI
        </button>
      </p>
    );
  }

  return (
    <div className="studio-ai" data-testid="ai-panel">
      <div className="studio-row">
        <label>
          <input type="radio" checked={mode === "generate"} onChange={() => setMode("generate")} /> New slides for
          “{lessonTitle}”
        </label>
        <label>
          <input type="radio" checked={mode === "edit"} onChange={() => setMode("edit")} /> Change the current slides
        </label>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={
          mode === "generate"
            ? "What should the lesson cover? An outline, key formulas, the level of the class…"
            : "What to change, e.g. “add a slide with a worked example after slide 3”, “translate to Russian”"
        }
        aria-label="AI request"
      />
      {mode === "generate" && (
        <div className="studio-row">
          <label>
            Slides <input type="number" min={3} max={30} value={slides} onChange={(e) => setSlides(Number(e.target.value))} />
          </label>
          <label>
            Language <input value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={40} />
          </label>
        </div>
      )}
      <div className="report-actions">
        <button type="button" className="class-present-btn" onClick={run} disabled={busy || prompt.trim().length < 5} data-testid="ai-run">
          {busy ? "Writing… (up to a minute)" : mode === "generate" ? "Write slides" : "Apply change"}
        </button>
        {previous !== null && (
          <button
            type="button"
            className="bt-clear-btn"
            onClick={() => {
              onDeck(previous);
              setPrevious(null);
              setMsg(null);
            }}
          >
            Undo AI
          </button>
        )}
        <button type="button" className="link-btn muted" onClick={() => setOpen(false)}>
          close
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? "class-join-ok" : "class-join-err"} data-testid="ai-msg">
          {msg.text}
        </p>
      )}
      <p className="muted studio-fineprint">
        The site&rsquo;s free models may use what you send to improve their service — don&rsquo;t put student data in a
        request. Check every slide before you show it. <Link href="/studio/settings">Use your own key</Link>.
      </p>
    </div>
  );
}
