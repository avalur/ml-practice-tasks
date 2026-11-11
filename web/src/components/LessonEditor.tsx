"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";

import { useTheme } from "@/components/ThemeProvider";
import { STUDIO_LIMITS, type StudioHomeworkInput, type StudioItemInput } from "@/lib/studio-shared";
import { AiDeckPanel } from "./AiDeckPanel";
import { DeckFullscreen, slideAt, type ChatEntry, type SlidePos } from "./DeckFullscreen";

export type CatalogEntry = { type: "problem" | "notebook"; id: string; title: string; difficulty?: string };

type Props = {
  courseSlug: string;
  lesson: {
    slug: string;
    title: string;
    date: string | null;
    deck: string;
    practice: StudioItemInput[];
    homework: StudioHomeworkInput;
  };
  catalog: CatalogEntry[];
  courseTitle: string;
};

async function patch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not save.");
  return data;
}

/* One lesson, three parts: its name and date, what students do (practice in
 * class, homework after), and its slides. Each part saves on its own, so a
 * half-finished homework list never blocks saving the slides. */
export function LessonEditor({ courseSlug, lesson, catalog, courseTitle }: Props) {
  const url = `/api/studio/courses/${courseSlug}/lessons/${lesson.slug}`;
  return (
    <>
      <DetailsPart url={url} title={lesson.title} date={lesson.date} />
      <ItemsPart url={url} practice={lesson.practice} homework={lesson.homework} catalog={catalog} />
      <DeckPart
        url={url}
        courseSlug={courseSlug}
        lessonSlug={lesson.slug}
        deck={lesson.deck}
        lessonTitle={lesson.title}
        courseTitle={courseTitle}
      />
    </>
  );
}

function DetailsPart({ url, title: t0, date: d0 }: { url: string; title: string; date: string | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(t0);
  const [date, setDate] = useState(d0 ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = title !== t0 || date !== (d0 ?? "");
  return (
    <form
      className="studio-row"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await patch(url, { title, date });
          setMsg({ ok: true, text: "Saved." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        }
      }}
    >
      <label>
        Lesson title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={STUDIO_LIMITS.title} name="lesson-title" />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} name="lesson-date" />
      </label>
      <button type="submit" className="btn subtle small" disabled={!dirty || !title.trim()}>
        Save
      </button>
      {msg && <span className={msg.ok ? "class-join-ok" : "class-join-err"}>{msg.text}</span>}
    </form>
  );
}

function describe(item: StudioItemInput, catalog: Map<string, CatalogEntry>): string {
  if (item.type === "link") return `🔗 ${item.title}`;
  if (item.type === "assignment") return `📓 ${item.title} (hand-in: ${item.id})`;
  if (item.id.includes("*")) return `${item.type === "problem" ? "Tasks" : "Notebooks"} matching ${item.id}`;
  const hit = catalog.get(`${item.type}:${item.id}`);
  return hit ? `${hit.title} — ${item.id}` : item.id;
}

function ItemsPart({
  url,
  practice: p0,
  homework: h0,
  catalog,
}: {
  url: string;
  practice: StudioItemInput[];
  homework: StudioHomeworkInput;
  catalog: CatalogEntry[];
}) {
  const router = useRouter();
  const [practice, setPractice] = useState<StudioItemInput[]>(p0);
  const [hasHomework, setHasHomework] = useState(!!h0);
  const [due, setDue] = useState(h0?.due ?? "");
  const [homework, setHomework] = useState<StudioItemInput[]>(h0?.items ?? []);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const byKey = useMemo(() => new Map(catalog.map((c) => [`${c.type}:${c.id}`, c])), [catalog]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((c) => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, catalog]);

  const add = (target: "practice" | "homework", item: StudioItemInput) => {
    const set = target === "practice" ? setPractice : setHomework;
    set((list) =>
      list.some((i) => i.type === item.type && "id" in i && "id" in item && i.id === item.id) ? list : [...list, item],
    );
    if (target === "homework") setHasHomework(true);
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await patch(url, { practice, homework: hasHomework ? { due, items: homework } : null });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  const list = (items: StudioItemInput[], set: (f: (l: StudioItemInput[]) => StudioItemInput[]) => void, testId: string) => (
    <ul className="studio-items" data-testid={testId}>
      {items.length === 0 && <li className="muted">Nothing yet.</li>}
      {items.map((it, i) => (
        <li key={`${it.type}:${"id" in it ? it.id : it.href}:${i}`}>
          {describe(it, byKey)}{" "}
          <button type="button" className="link-btn muted" onClick={() => set((l) => l.filter((_, j) => j !== i))}>
            remove
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="studio-part" data-testid="items-part">
      <h2>Practice and homework</h2>
      <div className="studio-columns">
        <div>
          <h3>In class</h3>
          {list(practice, setPractice, "practice-list")}
        </div>
        <div>
          <h3>
            <label>
              <input type="checkbox" checked={hasHomework} onChange={(e) => setHasHomework(e.target.checked)} /> Homework
            </label>
          </h3>
          {hasHomework && (
            <>
              <label className="studio-inline">
                due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} name="homework-due" />
              </label>
              {list(homework, setHomework, "homework-list")}
            </>
          )}
        </div>
      </div>

      <div className="studio-picker">
        <input
          className="studio-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a task or notebook — e.g. binary search, numpy_basics, py_strings/*"
          aria-label="Find a task"
        />
        {query.includes("*") && (
          <div className="studio-result">
            <span>All tasks matching <code>{query.trim()}</code></span>
            <button type="button" className="link-btn" onClick={() => add("practice", { type: "problem", id: query.trim() })}>
              + in class
            </button>
            <button type="button" className="link-btn" onClick={() => add("homework", { type: "problem", id: query.trim() })}>
              + homework
            </button>
          </div>
        )}
        {results.map((c) => (
          <div key={`${c.type}:${c.id}`} className="studio-result" data-testid={`result-${c.id}`}>
            <span>
              {c.type === "notebook" ? "📓 " : ""}
              {c.title} <span className="muted">{c.id}</span>
              {c.difficulty && <span className={`badge ${c.difficulty}`}>{c.difficulty}</span>}
            </span>
            <button type="button" className="link-btn" onClick={() => add("practice", { type: c.type, id: c.id })}>
              + in class
            </button>
            <button type="button" className="link-btn" onClick={() => add("homework", { type: c.type, id: c.id })}>
              + homework
            </button>
          </div>
        ))}
        <ExtraItemForms onAdd={add} />
      </div>

      <div className="report-actions">
        <button type="button" className="btn subtle small" onClick={save} disabled={busy} data-testid="save-items">
          {busy ? "Saving…" : "Save practice & homework"}
        </button>
        {msg && <span className={`${msg.ok ? "class-join-ok" : "class-join-err"} pre-wrap`}>{msg.text}</span>}
      </div>
    </section>
  );
}

function ExtraItemForms({ onAdd }: { onAdd: (t: "practice" | "homework", i: StudioItemInput) => void }) {
  const [linkTitle, setLinkTitle] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [aId, setAId] = useState("");
  const [aTitle, setATitle] = useState("");
  const [aHref, setAHref] = useState("");
  return (
    <details className="studio-extra">
      <summary>Add a link or a notebook hand-in</summary>
      <div className="studio-row">
        <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" aria-label="Link title" />
        <input value={linkHref} onChange={(e) => setLinkHref(e.target.value)} placeholder="https://colab.research.google.com/…" aria-label="Link address" />
        <button
          type="button"
          className="link-btn"
          disabled={!linkTitle.trim() || !linkHref.trim()}
          onClick={() => {
            onAdd("practice", { type: "link", title: linkTitle.trim(), href: linkHref.trim() });
            setLinkTitle("");
            setLinkHref("");
          }}
        >
          + in class
        </button>
      </div>
      <div className="studio-row">
        <input value={aId} onChange={(e) => setAId(e.target.value)} placeholder="id, e.g. hw1-pandas" aria-label="Assignment id" />
        <input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="Title" aria-label="Assignment title" />
        <input value={aHref} onChange={(e) => setAHref(e.target.value)} placeholder="Template notebook link (optional)" aria-label="Template link" />
        {(["practice", "homework"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="link-btn"
            disabled={!aId.trim() || !aTitle.trim()}
            onClick={() => {
              onAdd(t, {
                type: "assignment",
                id: aId.trim(),
                title: aTitle.trim(),
                ...(aHref.trim() ? { templateHref: aHref.trim() } : {}),
              });
            }}
          >
            + {t === "practice" ? "in class" : "homework"}
          </button>
        ))}
      </div>
    </details>
  );
}

function DeckPart({
  url,
  courseSlug,
  lessonSlug,
  deck: d0,
  lessonTitle,
  courseTitle,
}: {
  url: string;
  courseSlug: string;
  lessonSlug: string;
  deck: string;
  lessonTitle: string;
  courseTitle: string;
}) {
  const { theme } = useTheme();
  const [deck, setDeck] = useState(d0);
  const [saved, setSaved] = useState(d0);
  const [previewKey, setPreviewKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [at, setAt] = useState<SlidePos>({ h: 0, v: 0 });
  const viewRef = useRef<EditorView | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dirty = deck !== saved;

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await patch(url, { deck });
      setDeck(data.deck);
      setSaved(data.deck);
      setPreviewKey((k) => k + 1);
      setMsg(
        data.stripped
          ? { ok: false, text: "Saved — but some markup is not allowed in slides (scripts other than py-editor, forms, embeds, outside images) and was removed. The editor now shows what is kept." }
          : { ok: true, text: "Saved." },
      );
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }
  const saveRef = useRef(save);
  saveRef.current = save;

  // ⌘S / Ctrl+S saves in both views; Esc leaves full screen unless it is
  // closing something inside the editor or the chat box first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === "Escape" && full && !e.defaultPrevented) {
        const t = e.target as HTMLElement | null;
        if (!t?.closest(".cm-editor, textarea, input")) setFull(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  // The page behind the overlay must not scroll under the wheel.
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [full]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function upload(file: File) {
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/studio/courses/${courseSlug}/assets`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Upload failed." });
      return;
    }
    const tag = `<img src="${data.url}" alt="${file.name.replace(/["<>]/g, "")}">`;
    const view = viewRef.current;
    if (view) {
      const at = view.state.selection.main.head;
      view.dispatch({ changes: { from: at, insert: tag } });
    } else {
      setDeck((d) => `${d}\n${tag}\n`);
    }
    setMsg({ ok: true, text: full ? "Image uploaded and inserted." : "Image uploaded and inserted — save to see it." });
  }

  const presentUrl = `/classes/${courseSlug}/${lessonSlug}/present.html`;
  const slideCount = (deck.match(/<section\b/gi) ?? []).length;

  // One editor, mounted in whichever view is showing — so the upload button
  // always inserts at the cursor the teacher is looking at.
  const editor = (height: string) => (
    <CodeMirror
      value={deck}
      height={height}
      theme={theme}
      extensions={[html(), EditorView.lineWrapping]}
      onChange={setDeck}
      onCreateEditor={(view) => {
        viewRef.current = view;
      }}
      onUpdate={(u) => {
        if (!u.selectionSet && !u.docChanged) return;
        const next = slideAt(u.state.sliceDoc(0, u.state.selection.main.head), Infinity);
        setAt((cur) => (cur.h === next.h && cur.v === next.v ? cur : next));
      }}
      className="editor-cm"
    />
  );
  const saveButton = (
    <button type="button" className="class-present-btn" onClick={save} disabled={busy || !dirty} data-testid="save-deck">
      {busy ? "Saving…" : dirty ? "Save slides" : "Saved"}
    </button>
  );
  const uploadButton = (
    <button type="button" className="btn subtle small" onClick={() => fileRef.current?.click()}>
      Upload image
    </button>
  );
  const message = msg && (
    <p className={`${msg.ok ? "class-join-ok" : "class-join-err"}${full ? " studio-fs-msg" : ""}`} data-testid="deck-msg">
      {msg.text}
    </p>
  );

  return (
    <section className="studio-part" data-testid="deck-part">
      <h2>Slides</h2>
      <p className="muted">
        Each slide is a <code>&lt;section&gt;</code>. Formulas in <code>$…$</code>, fragments with{" "}
        <code>class=&quot;fragment&quot;</code>, speaker notes in <code>&lt;aside class=&quot;notes&quot;&gt;</code>. Runnable
        Python goes in <code>&lt;script type=&quot;py-editor&quot;&gt;</code> (<code>env=&quot;…&quot;</code> to share variables
        between slides); no other scripts, forms or embeds. Images come from the upload button.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        data-testid="image-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {full ? (
        <>
          <p className="muted">
            Editing in full screen.{" "}
            <button type="button" className="link-btn" onClick={() => setFull(false)}>
              Back here
            </button>
          </p>
          <DeckFullscreen
            courseSlug={courseSlug}
            lessonSlug={lessonSlug}
            lessonTitle={lessonTitle}
            courseTitle={courseTitle}
            deck={deck}
            onDeck={setDeck}
            at={at}
            editor={editor("100%")}
            toolbar={
              <>
                {saveButton}
                {uploadButton}
                <span className="muted">{slideCount} slides</span>
              </>
            }
            message={message}
            chatOpen={chatOpen}
            setChatOpen={setChatOpen}
            chatLog={chatLog}
            setChatLog={setChatLog}
            onClose={() => setFull(false)}
          />
        </>
      ) : (
        <>
          <AiDeckPanel
            courseSlug={courseSlug}
            lessonSlug={lessonSlug}
            lessonTitle={lessonTitle}
            courseTitle={courseTitle}
            currentDeck={deck}
            onDeck={(d) => setDeck(d)}
          />
          <div className="studio-deck">
            <div className="studio-deck-editor">
              {editor("520px")}
              <div className="report-actions">
                {saveButton}
                {uploadButton}
                <button type="button" className="btn subtle small" onClick={() => setFull(true)} data-testid="open-fullscreen">
                  Open full screen
                </button>
                <a className="link-btn" href={presentUrl} target="_blank" rel="noopener">
                  Present ↗
                </a>
                <span className="muted">{slideCount} slides</span>
              </div>
              {message}
            </div>
            <iframe
              key={previewKey}
              className="studio-preview"
              src={presentUrl}
              title="Slide preview"
              data-testid="deck-preview"
            />
          </div>
        </>
      )}
    </section>
  );
}
