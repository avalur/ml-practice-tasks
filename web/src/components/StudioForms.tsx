"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { STUDIO_LIMITS } from "@/lib/studio-shared";

/* Small Studio forms that share one shape: a few fields, one request, then
 * either navigate or refresh. */

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function NewCourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await send("/api/studio/courses", "POST", { title, description });
      router.push(`/studio/${data.slug}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="teach-form" onSubmit={submit} data-testid="new-course">
      <label>
        Course title
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={STUDIO_LIMITS.title}
          placeholder="e.g. Python for 10th grade"
        />
      </label>
      <label>
        Description <span className="muted">(optional, shown on the course page)</span>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={STUDIO_LIMITS.description}
          rows={3}
        />
      </label>
      <div>
        <button type="submit" className="class-present-btn" disabled={busy || !title.trim()}>
          {busy ? "Creating…" : "Create course"}
        </button>
      </div>
      {err && <p className="class-join-err">{err}</p>}
    </form>
  );
}

export function CourseDetailsForm({
  slug,
  title: initialTitle,
  description: initialDescription,
}: {
  slug: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = title !== initialTitle || description !== initialDescription;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await send(`/api/studio/courses/${slug}`, "PATCH", { title, description });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <form className="teach-form" onSubmit={submit}>
      <label>
        Title
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={STUDIO_LIMITS.title} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={STUDIO_LIMITS.description}
          rows={3}
        />
      </label>
      <div className="report-actions">
        <button type="submit" className="bt-clear-btn" disabled={busy || !dirty || !title.trim()}>
          {busy ? "Saving…" : "Save details"}
        </button>
        {msg && <span className={msg.ok ? "class-join-ok" : "class-join-err"}>{msg.text}</span>}
      </div>
    </form>
  );
}

type LessonRow = { slug: string; title: string; date: string | null; slides: number };

export function LessonList({ slug, lessons }: { slug: string; lessons: LessonRow[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(lessons);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The server list is the truth after every refresh.
  const [seen, setSeen] = useState(lessons);
  if (seen !== lessons) {
    setSeen(lessons);
    setOrder(lessons);
  }

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  function move(i: number, d: -1 | 1) {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    run(() => send(`/api/studio/courses/${slug}/order`, "POST", { lessons: next.map((l) => l.slug) }));
  }

  return (
    <section data-testid="lesson-list">
      <ol className="studio-lessons">
        {order.map((l, i) => (
          <li key={l.slug} className="studio-lesson" data-testid={`lesson-${l.slug}`}>
            <a href={`/studio/${slug}/${l.slug}`} className="class-lesson-title">
              {l.title}
            </a>
            <span className="muted">
              {l.date ?? "no date"} · {l.slides} slide{l.slides === 1 ? "" : "s"}
            </span>
            <span className="studio-lesson-actions">
              <button type="button" className="link-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button
                type="button"
                className="link-btn"
                disabled={busy || i === order.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="link-btn muted"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete “${l.title}” and its slides? Ink from delivered lessons is kept, but the lesson is gone.`)) {
                    run(() => send(`/api/studio/courses/${slug}/lessons/${l.slug}`, "DELETE"));
                  }
                }}
              >
                delete
              </button>
            </span>
          </li>
        ))}
      </ol>
      <form
        className="class-join-row studio-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          run(async () => {
            await send(`/api/studio/courses/${slug}`, "POST", { title });
            setTitle("");
          });
        }}
      >
        <input
          className="plain"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New lesson title"
          maxLength={STUDIO_LIMITS.title}
          aria-label="New lesson title"
        />
        <button type="submit" className="bt-clear-btn" disabled={busy || !title.trim()}>
          Add lesson
        </button>
      </form>
      {err && <p className="class-join-err">{err}</p>}
    </section>
  );
}

export function DeleteCourseButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="bt-clear-btn danger"
        onClick={async () => {
          if (!window.confirm("Delete this course with all its lessons, slides and images? This cannot be undone.")) return;
          try {
            await send(`/api/studio/courses/${slug}`, "DELETE");
            router.push("/studio");
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        Delete course
      </button>
      {err && <span className="class-join-err">{err}</span>}
    </>
  );
}
