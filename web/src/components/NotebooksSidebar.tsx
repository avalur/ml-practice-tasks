"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Notebook = { slug: string; title: string; difficulty: string };
type Section  = { slug: string; title: string; notebooks: Notebook[] };

const VISITED_KEY = "mlp:nb-visited";

export function NotebooksSidebar({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITED_KEY);
      if (raw) setVisited(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  // Mark current notebook visited on each navigation
  useEffect(() => {
    const m = pathname.match(/^\/notebooks\/([^/]+)\/([^/]+)/);
    if (!m) return;
    const key = `${m[1]}/${m[2]}`;
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem(VISITED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [pathname]);

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

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Notebooks</span>
        <button className="sidebar-toggle" onClick={() => setCollapsed(true)}
          title="Hide panel" aria-label="Hide panel">
          ◂
        </button>
      </div>

      <nav className="tree">
        {sections.map((section) => (
          <SectionFolder
            key={section.slug}
            section={section}
            pathname={pathname}
            visited={visited}
          />
        ))}
      </nav>
    </aside>
  );
}

function SectionFolder({
  section,
  pathname,
  visited,
}: {
  section: Section;
  pathname: string;
  visited: Set<string>;
}) {
  const currentSection = pathname.match(/^\/notebooks\/([^/]+)/)?.[1];
  const isActive = currentSection === section.slug;
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const visitedCount = section.notebooks.filter((nb) =>
    visited.has(`${section.slug}/${nb.slug}`)
  ).length;

  return (
    <div className="folder">
      <button className="folder-head" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? "▾" : "▸"}</span>
        <span className="folder-label">{section.title}</span>
        <span className="folder-count">{visitedCount}/{section.notebooks.length}</span>
      </button>
      {open && (
        <div className="folder-body">
          {section.notebooks.map((nb) => {
            const href    = `/notebooks/${section.slug}/${nb.slug}`;
            const active  = pathname === href;
            const isVisit = visited.has(`${section.slug}/${nb.slug}`);
            return (
              <Link key={nb.slug} href={href}
                className={`file${active ? " active" : ""}`}>
                <span className={`check${isVisit ? " done" : ""}`}>
                  {isVisit ? "✓" : "•"}
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
