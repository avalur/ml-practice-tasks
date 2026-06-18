"use client";

import { useState } from "react";

export function NotebookFrame({
  src,
  notebookId,
  title,
  canReset,
}: {
  src: string;
  notebookId: string;
  title: string;
  canReset: boolean;
}) {
  // Bumping `reloadKey` remounts the iframe → fresh HTML load, which re-runs the
  // restore script (after a reset there's no saved code, so the starter loads).
  const [reloadKey, setReloadKey] = useState(0);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (resetting) return;
    if (!window.confirm("Reset this notebook to the starter code? Your saved work for it will be erased.")) {
      return;
    }
    setResetting(true);
    try {
      await fetch(`/api/notebook-progress?notebookId=${encodeURIComponent(notebookId)}`, {
        method: "DELETE",
      });
      // Tell the sidebar to drop this notebook's ✓ (separate BroadcastChannel
      // instance → the sidebar's instance receives it).
      try {
        const ch = new BroadcastChannel("mlp-notebooks");
        ch.postMessage({ type: "mlp:notebook-unsolved", notebookId });
        ch.close();
      } catch {
        // BroadcastChannel unavailable — sidebar refreshes on next load
      }
    } catch {
      // ignore — still reload to show whatever is current
    }
    setReloadKey((k) => k + 1);
    setResetting(false);
  }

  return (
    <div className="notebook-frame-wrapper">
      <div className="notebook-toolbar">
        <span className="notebook-toolbar-title">{title}</span>
        {canReset && (
          <button className="bt-clear-btn" onClick={reset} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset to starter"}
          </button>
        )}
      </div>
      <iframe
        key={reloadKey}
        src={src}
        title={title}
        className="notebook-frame"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
