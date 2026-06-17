"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Notebook = { slug: string; title: string; difficulty: string };
type Section  = { slug: string; title: string; notebooks: Notebook[] };

export function NotebooksSidebar({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());

  const fetchSolved = useCallback(() => {
    fetch("/api/notebook-progress")
      .then((r) => (r.ok ? r.json() : { solved: [] }))
      .then((d) => setSolved(new Set<string>(d.solved ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSolved(); }, [fetchSolved]);

  // Listen for postMessage from marimo iframe on test success
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "mlp:notebook-solved") return;
      const notebookId = e.data.notebookId;
      if (typeof notebookId !== "string") return;

      // Optimistic update
      setSolved((prev) => prev.has(notebookId) ? prev : new Set(prev).add(notebookId));

      // Persist to DB (fire-and-forget)
      fetch("/api/notebook-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId }),
      }).catch(() => {});
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={() => setCollapsed(false)}
          title="Show notebooks" aria-label="Show notebooks">
          ▸
        </button>
      </aside>
    );
  }

  const total   = sections.reduce((n, s) => n + s.notebooks.length, 0);
  const solvedN = sections.reduce((n, s) =>
    n + s.notebooks.filter((nb) => solved.has(`${s.slug}/${nb.slug}`)).length, 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Notebooks</span>
        <button className="sidebar-toggle" onClick={() => setCollapsed(true)}
          title="Hide panel" aria-label="Hide panel">
          ◂
        </button>
      </div>

      <div className="sidebar-progress">
        <div className="muted">{solvedN}/{total} solved</div>
        <div className="bar">
          <div className="bar-fill"
            style={{ width: `${total ? (solvedN / total) * 100 : 0}%` }} />
        </div>
      </div>

      <nav className="tree">
        {sections.map((section) => (
          <SectionFolder
            key={section.slug}
            section={section}
            pathname={pathname}
            solved={solved}
          />
        ))}
      </nav>
    </aside>
  );
}

function SectionFolder({
  section,
  pathname,
  solved,
}: {
  section: Section;
  pathname: string;
  solved: Set<string>;
}) {
  const currentSection = pathname.match(/^\/notebooks\/([^/]+)/)?.[1];
  const isActive = currentSection === section.slug;
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const solvedCount = section.notebooks.filter((nb) =>
    solved.has(`${section.slug}/${nb.slug}`)
  ).length;

  return (
    <div className="folder">
      <button className="folder-head" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? "▾" : "▸"}</span>
        <span className="folder-label">{section.title}</span>
        <span className="folder-count">{solvedCount}/{section.notebooks.length}</span>
      </button>
      {open && (
        <div className="folder-body">
          {section.notebooks.map((nb) => {
            const href     = `/notebooks/${section.slug}/${nb.slug}`;
            const active   = pathname === href;
            const isSolved = solved.has(`${section.slug}/${nb.slug}`);
            return (
              <Link key={nb.slug} href={href}
                className={`file${active ? " active" : ""}`}>
                <span className={`check${isSolved ? " done" : ""}`}>
                  {isSolved ? "✓" : "•"}
                </span>
                <span className="file-title">{nb.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
