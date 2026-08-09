"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import notebooksManifest from "../../../notebooks/manifest.json";

type FeedEvent = {
  kind: "problem" | "notebook";
  at: string;
  userId: string;
  userName: string;
  id: string;
  title: string | null;
  status: "passed" | "failed";
  passed?: number;
  total?: number;
};

const POLL_MS = 4000;

// Notebook titles are build-time content; resolve them here so the API stays lean.
const NOTEBOOK_TITLES: Record<string, string> = {};
for (const section of notebooksManifest.sections) {
  for (const nb of section.notebooks) {
    NOTEBOOK_TITLES[`${section.slug}/${nb.slug}`] = nb.title;
  }
}

function label(ev: FeedEvent): string {
  if (ev.title) return ev.title;
  if (ev.kind === "notebook") return NOTEBOOK_TITLES[ev.id] ?? ev.id;
  return ev.id;
}

function clock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function MonitorFeed({ classSlug }: { classSlug: string }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [working, setWorking] = useState(0);
  const [members, setMembers] = useState(0);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const since = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const qs = since.current ? `?since=${encodeURIComponent(since.current)}` : "";
      const res = await fetch(`/api/classes/${encodeURIComponent(classSlug)}/feed${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Not a teacher of this class." : `Feed error ${res.status}`);
        return;
      }
      const data = await res.json();
      setError(null);
      setWorking(data.working ?? 0);
      setMembers(data.members ?? 0);
      const fresh: FeedEvent[] = (data.events ?? []).filter((ev: FeedEvent) => {
        const key = `${ev.kind}|${ev.userId}|${ev.id}|${ev.at}`;
        if (seen.current.has(key)) return false;
        seen.current.add(key);
        return true;
      });
      if (fresh.length) setEvents((prev) => [...fresh, ...prev].slice(0, 300));
      // Advance the cursor only after a successful merge, so a dropped response
      // never silently skips events.
      since.current = data.now;
    } catch {
      setError("Offline — retrying…");
    }
  }, [classSlug]);

  useEffect(() => {
    poll();
    if (!live) return;
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll, live]);

  const shown = onlyFailed ? events.filter((e) => e.status === "failed") : events;

  return (
    <div className="mon">
      <div className="mon-head">
        <span className="mon-title">Live submissions</span>
        <button
          className="bt-clear-btn"
          onClick={() => setLive((v) => !v)}
          title={live ? "Pause polling" : "Resume polling"}
        >
          {live ? "⏸ Pause" : "▶ Resume"}
        </button>
      </div>

      <div className="mon-stats">
        <span>{members} member{members === 1 ? "" : "s"}</span>
        <span className="muted">{working} mid-attempt</span>
        <label className="mon-filter">
          <input
            type="checkbox"
            checked={onlyFailed}
            onChange={(e) => setOnlyFailed(e.target.checked)}
          />
          failures only
        </label>
      </div>

      {error && <p className="class-join-err">{error}</p>}

      {shown.length === 0 ? (
        <p className="muted mon-empty">
          Nothing yet. Runs by class members appear here within a few seconds.
        </p>
      ) : (
        <ul className="mon-list">
          {shown.map((ev) => (
            <li
              key={`${ev.kind}|${ev.userId}|${ev.id}|${ev.at}`}
              className={ev.status === "passed" ? "mon-ok" : "mon-bad"}
            >
              <span className="mon-time">{clock(ev.at)}</span>
              <span className="mon-mark">{ev.status === "passed" ? "✓" : "✗"}</span>
              <span className="mon-who">{ev.userName}</span>
              <span className="mon-what">{label(ev)}</span>
              {ev.kind === "problem" && ev.total ? (
                <span className="mon-score">
                  {ev.passed}/{ev.total}
                </span>
              ) : (
                <span className="mon-score mon-nb">notebook</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
