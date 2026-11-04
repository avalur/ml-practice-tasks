"use client";

import { useState } from "react";
import Link from "next/link";

export type AiRequest = {
  course: string;
  lesson: string;
  mode: "generate" | "edit";
  prompt: string;
  slides: number;
  language: string;
  deck: string;
};

/** One call to the AI route, shared by this panel and the full-screen chat. The
 * text is what to show the teacher either way. */
export async function askAi(body: AiRequest): Promise<{ ok: true; deck: string; text: string } | { ok: false; text: string }> {
  try {
    const res = await fetch("/api/studio/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, text: data.error ?? "The request failed." };
    return {
      ok: true,
      deck: data.deck,
      text:
        `Done with ${data.via}. Read it through, then Save slides.` +
        (data.remaining !== null && data.remaining !== undefined ? ` ${data.remaining} free requests left today.` : ""),
    };
  } catch {
    return { ok: false, text: "Network error — try again." };
  }
}

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
    const r = await askAi({ course: courseSlug, lesson: lessonSlug, mode, prompt, slides, language, deck: currentDeck });
    if (r.ok) {
      setPrevious(currentDeck);
      onDeck(r.deck);
    }
    setMsg({ ok: r.ok, text: r.text });
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
