"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { AiProgressView, askAi, type AiProgress } from "./AiDeckPanel";

/* The full-screen slide editor: an optional AI chat on the left, the HTML in the
 * middle, and on the right the slide under the cursor, rendered live from the
 * unsaved text. The editor itself is passed in, so the page's one CodeMirror —
 * with its image-upload cursor and its Save — is the same in both views. */

export type SlidePos = { h: number; v: number };

/** Which slide the text offset `pos` is in, as reveal's (h, v) indices: a
 * top-level <section> is a column, a <section> inside one is a row in it. */
export function slideAt(text: string, pos: number): SlidePos {
  const re = /<(\/?)section\b[^>]*>/gi;
  let h = -1;
  let v = -1;
  let depth = 0;
  for (let m = re.exec(text); m && m.index < pos; m = re.exec(text)) {
    if (m[1]) {
      depth = Math.max(0, depth - 1);
    } else {
      if (depth === 0) {
        h++;
        v = -1;
      } else if (depth === 1) {
        v++;
      }
      depth++;
    }
  }
  return { h: Math.max(h, 0), v: Math.max(v, 0) };
}

export type ChatEntry =
  { who: "you"; text: string } | { who: "ai"; ok: boolean; text: string; before?: string; undone?: boolean };

type RevealApi = {
  isReady(): boolean;
  on(ev: string, fn: () => void): void;
  configure(o: object): void;
  slide(h: number, v: number): void;
  getIndices(): { h: number; v: number };
};
const revealOf = (f: HTMLIFrameElement | null): RevealApi | undefined => {
  try {
    return (f?.contentWindow as (Window & { Reveal?: RevealApi }) | null)?.Reveal;
  } catch {
    return undefined;
  }
};

/* Two iframes, one shown and one loading: each change of the text is POSTed
 * into the hidden one, which is swapped in once reveal is ready and on the
 * cursor's slide — so typing never flashes a blank or a first slide. */
function LivePreview({ action, deck, at }: { action: string; deck: string; at: SlidePos }) {
  const name = `deck-preview-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const a = useRef<HTMLIFrameElement | null>(null);
  const b = useRef<HTMLIFrameElement | null>(null);
  const frames = [a, b];
  const form = useRef<HTMLFormElement | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const [front, setFront] = useState<0 | 1 | null>(null);
  const frontRef = useRef<0 | 1 | null>(null);
  const pending = useRef<0 | 1 | null>(null);
  const atRef = useRef(at);
  atRef.current = at;

  useEffect(() => {
    const t = setTimeout(
      () => {
        if (!form.current || !field.current) return;
        const back = frontRef.current === 0 ? 1 : 0;
        pending.current = back;
        field.current.value = deck;
        form.current.target = `${name}-${back}`;
        form.current.submit();
      },
      frontRef.current === null ? 0 : 450,
    );
    return () => clearTimeout(t);
  }, [deck, action, name]);

  useEffect(() => {
    if (frontRef.current === null) return;
    const R = revealOf(frames[frontRef.current].current);
    if (!R?.isReady?.()) return;
    const now = R.getIndices();
    if (now.h !== at.h || (now.v ?? 0) !== at.v) R.slide(at.h, at.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at.h, at.v]);

  const onLoad = (i: 0 | 1) => {
    const f = frames[i].current;
    if (pending.current !== i || !f) return;
    try {
      if (f.contentWindow?.location.href === "about:blank") return;
    } catch {
      /* not ours to read — show whatever it is */
    }
    const show = () => {
      if (pending.current !== i) return;
      pending.current = null;
      frontRef.current = i;
      setFront(i);
    };
    const R = revealOf(f);
    if (!R) return show(); // an error page: show its text
    const go = () => {
      try {
        R.slide(atRef.current.h, atRef.current.v);
      } catch {
        /* a deck reveal could not lay out still shows */
      }
      show();
    };
    if (R.isReady()) go();
    else R.on("ready", go);
  };

  return (
    <div className="studio-fs-preview" data-testid="fs-preview">
      <form ref={form} method="post" action={action} hidden>
        <textarea ref={field} name="deck" readOnly />
      </form>
      <div className="studio-fs-stage">
        {([0, 1] as const).map((i) => (
          <iframe
            key={i}
            ref={frames[i]}
            name={`${name}-${i}`}
            title={front === i ? "Live slide preview" : "Preview (loading)"}
            className={front === i ? "front" : "back"}
            data-testid={front === i ? "fs-preview-front" : undefined}
            onLoad={() => onLoad(i)}
          />
        ))}
        {front === null && <p className="muted studio-fs-loading">Rendering…</p>}
      </div>
    </div>
  );
}

function AiChat({
  courseSlug,
  lessonSlug,
  lessonTitle,
  deck,
  onDeck,
  log,
  setLog,
  onClose,
}: {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  deck: string;
  onDeck: (d: string) => void;
  log: ChatEntry[];
  setLog: (f: (l: ChatEntry[]) => ChatEntry[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"generate" | "edit">(() =>
    (deck.match(/<section\b/gi) ?? []).length > 2 ? "edit" : "generate",
  );
  const [prompt, setPrompt] = useState("");
  const [slides, setSlides] = useState(10);
  const [language, setLanguage] = useState("English");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AiProgress | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const slidesDone = progress ? (progress.text.match(/<\/section>/gi) ?? []).length : 0;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [log.length, busy, slidesDone]);

  async function send() {
    const text = prompt.trim();
    if (busy || text.length < 5) return;
    const before = deck;
    setBusy(true);
    setProgress(null);
    setPrompt("");
    setLog((l) => [...l, { who: "you", text: mode === "generate" ? `New deck: ${text}` : text }]);
    const r = await askAi(
      {
        course: courseSlug,
        lesson: lessonSlug,
        mode,
        prompt: text,
        slides,
        language,
        deck: before,
      },
      setProgress,
    );
    if (r.ok) {
      onDeck(r.deck);
      const n = (r.deck.match(/<section\b/gi) ?? []).length;
      setLog((l) => [...l, { who: "ai", ok: true, text: `${n} slides. ${r.text}`, before }]);
      // Once there is a deck, the natural next request is a change to it.
      setMode("edit");
    } else {
      setLog((l) => [...l, { who: "ai", ok: false, text: r.text }]);
      setPrompt(text);
    }
    setBusy(false);
  }

  // Only the latest answer can be undone: stepping back past a later one would
  // silently throw that one away too.
  const lastOk = log.findLastIndex((e) => e.who === "ai" && e.ok);

  return (
    <aside className="studio-chat" data-testid="fs-chat" aria-label="AI assistant">
      <div className="studio-chat-head">
        <strong>✨ AI</strong>
        <div className="studio-seg" role="radiogroup" aria-label="What the AI does">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "edit"}
            className={mode === "edit" ? "on" : ""}
            onClick={() => setMode("edit")}
          >
            Change slides
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "generate"}
            className={mode === "generate" ? "on" : ""}
            onClick={() => setMode("generate")}
          >
            New deck
          </button>
        </div>
        <button type="button" className="link-btn muted" onClick={onClose} aria-label="Close AI chat">
          ✕
        </button>
      </div>
      <div className="studio-chat-log" data-testid="fs-chat-log">
        {log.length === 0 && (
          <p className="muted">
            {mode === "generate"
              ? `Describe the lesson “${lessonTitle}”: what it covers, key formulas, the level of the class.`
              : "Ask for a change: “add a worked example after slide 3”, “shorten every slide”, “translate to Russian”."}
          </p>
        )}
        {log.map((e, i) => (
          <div key={i} className={`studio-msg ${e.who}${e.who === "ai" && !e.ok ? " err" : ""}`}>
            {e.text}
            {e.who === "ai" && e.ok && e.before !== undefined && i === lastOk && (
              <div>
                {e.undone ? (
                  <span className="muted">Undone.</span>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onDeck(e.before!);
                      setLog((l) => l.map((x, j) => (j === i ? { ...x, undone: true } : x)));
                    }}
                  >
                    Undo this change
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="studio-msg ai">
            <AiProgressView progress={progress} />
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="studio-chat-input">
        {mode === "generate" && (
          <div className="studio-row">
            <label>
              Slides{" "}
              <input
                type="number"
                min={3}
                max={30}
                value={slides}
                onChange={(e) => setSlides(Number(e.target.value))}
              />
            </label>
            <label>
              Language <input value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={40} />
            </label>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder={mode === "generate" ? "What should the lesson cover?" : "What should change?"}
          aria-label="Message to the AI"
          data-testid="fs-chat-input"
        />
        <button
          type="button"
          className="class-present-btn"
          onClick={send}
          disabled={busy || prompt.trim().length < 5}
          data-testid="fs-chat-send"
        >
          {busy ? "Working…" : mode === "generate" ? "Write the deck" : "Apply"}
        </button>
        <p className="muted studio-fineprint">
          {mode === "generate" ? "A new deck replaces the text in the editor. " : ""}
          Nothing is saved until you press Save. The site&rsquo;s model is run by a third party — no student data.{" "}
          <Link href="/studio/settings">Own key</Link>.
        </p>
      </div>
    </aside>
  );
}

export function DeckFullscreen({
  courseSlug,
  lessonSlug,
  lessonTitle,
  courseTitle,
  deck,
  onDeck,
  at,
  editor,
  toolbar,
  message,
  chatOpen,
  setChatOpen,
  chatLog,
  setChatLog,
  onClose,
}: {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  courseTitle: string;
  deck: string;
  onDeck: (d: string) => void;
  at: SlidePos;
  editor: ReactNode;
  toolbar: ReactNode;
  message: ReactNode;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatLog: ChatEntry[];
  setChatLog: (f: (l: ChatEntry[]) => ChatEntry[]) => void;
  onClose: () => void;
}) {
  const presentUrl = `/classes/${courseSlug}/${lessonSlug}/present.html`;
  return (
    <div className="studio-fs" role="dialog" aria-modal="true" aria-label="Slide editor" data-testid="deck-fullscreen">
      <div className="studio-fs-bar">
        <button
          type="button"
          className={`btn subtle small${chatOpen ? " on" : ""}`}
          onClick={() => setChatOpen(!chatOpen)}
          aria-pressed={chatOpen}
          data-testid="fs-ai"
        >
          ✨ AI
        </button>
        <span className="studio-fs-title">
          <strong>{lessonTitle}</strong> <span className="muted">· {courseTitle}</span>
        </span>
        {toolbar}
        <span className="muted">
          slide {at.h + 1}
          {at.v > 0 ? `.${at.v + 1}` : ""}
        </span>
        <a className="btn subtle small" href={presentUrl} target="_blank" rel="noopener">
          Present ↗
        </a>
        <button type="button" className="btn subtle small" onClick={onClose} data-testid="fs-exit" title="Esc">
          Exit full screen
        </button>
      </div>
      {message}
      <div className={`studio-fs-body${chatOpen ? " with-chat" : ""}`}>
        {chatOpen && (
          <AiChat
            courseSlug={courseSlug}
            lessonSlug={lessonSlug}
            lessonTitle={lessonTitle}
            deck={deck}
            onDeck={onDeck}
            log={chatLog}
            setLog={setChatLog}
            onClose={() => setChatOpen(false)}
          />
        )}
        <div className="studio-fs-editor">{editor}</div>
        <LivePreview action={`/api/studio/courses/${courseSlug}/lessons/${lessonSlug}/preview`} deck={deck} at={at} />
      </div>
    </div>
  );
}
