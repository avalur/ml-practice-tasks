"use client";

import { useEffect, useRef, useState } from "react";
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

/** What the editor shows while a request runs. */
export type AiProgress = {
  via: string | null;
  reasoning: string;
  text: string;
  startedAt: number;
  /** The lesson the prompt linked to, as the server read it. */
  source: { title: string; slides: number; images: number; files: number } | null;
};

/** One call to the AI route, shared by this panel and the full-screen chat.
 * Refusals come back as JSON with a status; a running request is a stream of
 * newline-delimited events, reported through `onProgress` as they arrive. The
 * text is what to show the teacher either way. */
export async function askAi(
  body: AiRequest,
  onProgress?: (p: AiProgress) => void,
): Promise<{ ok: true; deck: string; text: string } | { ok: false; text: string }> {
  const progress: AiProgress = { via: null, reasoning: "", text: "", startedAt: Date.now(), source: null };
  try {
    const res = await fetch("/api/studio/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, text: data.error ?? "The request failed." };
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const e = JSON.parse(line) as
          | { type: "start"; via: string }
          | { type: "source"; title: string; slides: number; images: number; files: number }
          | { type: "reasoning" | "text"; text: string }
          | { type: "done"; deck: string; via: string; remaining: number | null }
          | { type: "error"; error: string };
        if (e.type === "start") {
          // A fallback to the next provider starts over.
          Object.assign(progress, { via: e.via, reasoning: "", text: "" });
        } else if (e.type === "source") {
          progress.source = { title: e.title, slides: e.slides, images: e.images, files: e.files };
        } else if (e.type === "reasoning") {
          progress.reasoning += e.text;
        } else if (e.type === "text") {
          progress.text += e.text;
        } else if (e.type === "done") {
          return {
            ok: true,
            deck: e.deck,
            text:
              `Done with ${e.via} in ${elapsed(progress.startedAt)}. Read it through, then Save slides.` +
              (e.remaining !== null && e.remaining !== undefined ? ` ${e.remaining} requests to the site's model left today.` : ""),
          };
        } else if (e.type === "error") {
          return { ok: false, text: e.error };
        }
        onProgress?.({ ...progress });
      }
    }
    return { ok: false, text: "The answer was cut off — try again." };
  } catch {
    return { ok: false, text: "Network error — try again." };
  }
}

const elapsed = (from: number) => {
  const s = Math.max(0, Math.round((Date.now() - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Titles of the slides the model has finished so far, in order. A reference
 * to the linked lesson's slides (`<copy-source/>`, `<source-slides …/>`) is
 * listed as what it stands for. */
export function finishedSlides(text: string): string[] {
  const refs = /<copy-source\s*\/?>|<source-slides?\b[^>]*\/?>/gi;
  const describe = (tag: string) => {
    if (/^<copy-source/i.test(tag)) return "All slides of the linked lesson";
    const n = (k: string) => new RegExp(`\\b${k}\\s*=\\s*["']?(\\d+)`, "i").exec(tag)?.[1];
    const from = n("from") ?? n("n");
    const to = n("to");
    return to && to !== from ? `Linked lesson, slides ${from}–${to}` : `Linked lesson, slide ${from}`;
  };
  const out: string[] = [];
  const parts = text.replace(refs, (m) => `<section><h2>${describe(m)}</h2></section>`).split(/<\/section>/i);
  parts.pop(); // the slide still being written
  for (const p of parts) {
    // The closing tag of a wrapper around vertical slides leaves a part with
    // no <section> of its own: that is not a slide.
    if (!/<section\b/i.test(p)) continue;
    const h = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(p.slice(p.search(/<section\b/i)));
    out.push(h ? h[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "");
  }
  return out;
}

/** Live view of a running request: the clock, what the model is thinking, and
 * the slides it has written so far. */
export function AiProgressView({ progress }: { progress: AiProgress | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const tail = useRef<HTMLPreElement | null>(null);
  useEffect(() => {
    if (tail.current) tail.current.scrollTop = tail.current.scrollHeight;
  }, [progress?.reasoning]);
  if (!progress) return <p className="muted studio-ai-progress">Sending…</p>;
  const slides = finishedSlides(progress.text);
  const writing = progress.text.length > 0;
  return (
    <div className="studio-ai-progress" data-testid="ai-progress">
      <div>
        <strong>{writing ? `Writing slides — ${slides.length} done` : progress.reasoning ? "Thinking…" : "Waiting for the model…"}</strong>{" "}
        <span className="muted">
          {elapsed(progress.startedAt)}
          {progress.via ? ` · ${progress.via}` : ""}
        </span>
      </div>
      {progress.source && (
        <p className="muted" data-testid="ai-source">
          Read “{progress.source.title}”: {progress.source.slides} slides, {progress.source.images} images
          {progress.source.files ? `, ${progress.source.files} data files` : ""} copied into this course.
        </p>
      )}
      {slides.length > 0 && (
        <ol className="studio-ai-slides">
          {slides.map((t, i) => (
            <li key={i}>{t || <span className="muted">(untitled)</span>}</li>
          ))}
        </ol>
      )}
      {progress.reasoning && !writing && (
        <pre ref={tail} className="studio-ai-thoughts">
          {progress.reasoning.slice(-1500)}
        </pre>
      )}
    </div>
  );
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
  const [progress, setProgress] = useState<AiProgress | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setProgress(null);
    const r = await askAi({ course: courseSlug, lesson: lessonSlug, mode, prompt, slides, language, deck: currentDeck }, setProgress);
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
          {busy ? "Working…" : mode === "generate" ? "Write slides" : "Apply change"}
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
      {busy && <AiProgressView progress={progress} />}
      {msg && (
        <p className={msg.ok ? "class-join-ok" : "class-join-err"} data-testid="ai-msg">
          {msg.text}
        </p>
      )}
      <p className="muted studio-fineprint">
        The site&rsquo;s model is run by a third party (through OpenRouter) — don&rsquo;t put student data in a request.
        Check every slide before you show it. <Link href="/studio/settings">Use your own key</Link>.
      </p>
    </div>
  );
}
