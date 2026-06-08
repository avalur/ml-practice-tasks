"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 190;
const MAX = 560;
const DEFAULT = 260;

const clamp = (w: number) => Math.min(MAX, Math.max(MIN, w));

/**
 * Two-pane shell for the problems area: the folders sidebar on the left and the
 * page content on the right, with a JetBrains-style draggable splitter between
 * them. The splitter is a sibling of the sidebar (not a child) so the sidebar's
 * own `overflow: auto` can't clip it. Width is persisted; collapse stays in
 * ProblemsSidebar (the splitter hides via CSS when the sidebar is collapsed).
 */
export function ProblemsShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(DEFAULT);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const stored = parseInt(localStorage.getItem("mlp:sidebar-w") ?? "", 10);
    if (!Number.isNaN(stored)) setWidth(clamp(stored));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => setWidth(clamp(startW + (ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("mlp:sidebar-w", String(widthRef.current));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const reset = useCallback(() => {
    setWidth(DEFAULT);
    localStorage.setItem("mlp:sidebar-w", String(DEFAULT));
  }, []);

  return (
    <div
      className="problems-shell"
      style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}
    >
      {sidebar}
      <div
        className="sidebar-resizer"
        onMouseDown={onMouseDown}
        onDoubleClick={reset}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the problems panel"
        title="Drag to resize · double-click to reset"
      />
      <div className="problems-main">{children}</div>
    </div>
  );
}
