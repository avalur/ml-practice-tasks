"use client";

import { useEffect, useRef, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { python } from "@codemirror/lang-python";

// On Enter: preserve the current line's leading whitespace exactly.
// Overrides the Python language mode's "smart" dedent which drops 2 spaces.
const preserveIndentOnEnter = keymap.of([{
  key: "Enter",
  run(view) {
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const indent = line.text.match(/^\s*/)?.[0] ?? "";
    const insert = "\n" + indent;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + insert.length },
      scrollIntoView: true,
    });
    return true;
  },
}]);

// Breathing room so code/comments don't butt against the editor's right edge.
const editorPadding = EditorView.theme({
  ".cm-content": { paddingRight: "1.25rem" },
});
import Link from "next/link";
import type { ProblemMeta } from "@/lib/problem";
import {
  fetchReferenceSolution,
  loadBundle,
  type Bundle,
  type CodeResult,
  type RunResult,
  type RunnerStatus,
  type TestResult,
} from "@/lib/runner";
import { usePyodideRunner } from "@/hooks/usePyodideRunner";
import { useTheme } from "@/components/ThemeProvider";
import { useSession } from "next-auth/react";

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

export function SolveWorkspace({
  meta,
  starter,
  onSolve,
  nextTasks = [],
}: {
  meta: ProblemMeta;
  starter: string;
  onSolve?: () => void;
  nextTasks?: ProblemMeta[];
}) {
  const storageKey = `mlp:code:${meta.id}`;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(starter);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const runner = usePyodideRunner(meta.pyDeps);
  const { theme } = useTheme();
  const { data: session } = useSession();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const postedRef = useRef<RunResult | null>(null);

  // Reference solution tab state
  const [allPassed, setAllPassed] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(false);

  // Fullscreen mode state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  // Font size zoom state (for fullscreen mode)
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_FONT_SIZE;
    try {
      const saved = localStorage.getItem("mlp:editor-font-size");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_FONT_SIZE;
  });

  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  useEffect(() => {
    try {
      localStorage.setItem("mlp:editor-font-size", String(fontSize));
    } catch {}
  }, [fontSize]);

  // Resolve the editor's initial content once, with precedence:
  //   ?submission=<id>  →  local draft (your in-progress edits here)  →
  //   your last submission for this task  →  the starter stub.
  const hydratedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    const finish = (value?: string, solved?: boolean) => {
      if (!alive) return;
      if (typeof value === "string") setCode(value);
      if (solved) {
        setAllPassed(true);
        onSolve?.();
      }
      hydratedRef.current = true; // enable the autosave below
    };

    const isLocalSolved = () => {
      try {
        return localStorage.getItem(`mlp:solved:${meta.id}`) === "1";
      } catch {
        return false;
      }
    };

    const markSolvedLocally = () => {
      try {
        localStorage.setItem(`mlp:solved:${meta.id}`, "1");
      } catch {}
    };

    const subId = new URLSearchParams(window.location.search).get("submission");
    if (subId) {
      // Explicit submission from the profile: load it, then drop the param so a
      // refresh keeps later edits instead of reloading it.
      fetch(`/api/submissions/${subId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.code === "string") {
            const passed = Boolean(d.solved || isLocalSolved());
            if (passed) markSolvedLocally();
            finish(d.code, passed);
            window.history.replaceState(null, "", window.location.pathname);
          } else {
            finish(undefined, isLocalSolved());
          }
        })
        .catch(() => finish(undefined, isLocalSolved()));
      return () => {
        alive = false;
      };
    }

    const draft = localStorage.getItem(storageKey);
    const locallySolved = isLocalSolved();

    // Check remote solved state if user is logged in
    fetch(`/api/submissions/latest?problemId=${encodeURIComponent(meta.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const passed = Boolean(d?.solved || locallySolved);
        if (passed) markSolvedLocally();
        if (draft != null && draft !== starter) {
          finish(draft, passed); // unsaved local edits win
        } else {
          finish(typeof d?.code === "string" ? d.code : undefined, passed);
        }
      })
      .catch(() => {
        if (draft != null && draft !== starter) {
          finish(draft, locallySolved);
        } else {
          finish(undefined, locallySolved);
        }
      });
    return () => {
      alive = false;
    };
  }, [storageKey, starter, meta.id, onSolve]);

  // Persist edits locally so a reload keeps your work. Gated on hydration so the
  // initial stub never overwrites a restored draft or last-submission code.
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(storageKey, code);
  }, [storageKey, code]);

  // Fetch the static harness + problem files once.
  useEffect(() => {
    let alive = true;
    loadBundle(meta)
      .then((b) => alive && setBundle(b))
      .catch((e) => alive && setBundleError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [meta]);

  // Persist each completed run (logged-in users only), once per result.
  useEffect(() => {
    const r = runner.result;
    if (runner.status !== "done" || runner.mode !== "test" || !r || postedRef.current === r)
      return;
    postedRef.current = r;
    const allPass = r.total > 0 && r.passed === r.total;
    if (allPass) {
      setAllPassed(true);
      onSolve?.();
      try {
        localStorage.setItem(`mlp:solved:${meta.id}`, "1");
      } catch {}
    }
    if (!session?.user) return;
    // On a win, ask the sidebar to pulse this task's bullet while we persist —
    // it stays pulsing until the save settles and the green ✓ is set.
    if (allPass) {
      window.dispatchEvent(
        new CustomEvent("mlp:progress-pending", { detail: { problemId: meta.id } }),
      );
    }
    // Settle the pulse once the save resolves — always fire (even on failure)
    // so the bullet can't pulse forever; on a win this also flips the badge.
    const settle = (solved: boolean) =>
      window.dispatchEvent(
        new CustomEvent("mlp:progress", { detail: { problemId: meta.id, solved } }),
      );
    setSaveState("saving");
    fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        problemId: meta.id,
        code,
        clientStatus: allPass ? "passed" : "failed",
        passed: r.passed,
        total: r.total,
        durationMs: r.durationMs,
      }),
    })
      .then(async (res) => {
        setSaveState(res.ok ? "saved" : "error");
        const data = res.ok
          ? ((await res.json().catch(() => null)) as { solved?: boolean } | null)
          : null;
        settle(!!data?.solved);
      })
      .catch(() => {
        setSaveState("error");
        settle(false);
      });
  }, [runner.status, runner.mode, runner.result, session, meta.id, code, onSolve]);

  const busy = runner.status === "running" || runner.status === "loading";

  // The code currently visible in the editor (user's or reference).
  const activeCode = showRef && refCode !== null ? refCode : code;

  const onRun = () => {
    if (busy || !bundle) return;
    runner.run({
      files: { ...bundle.files, [bundle.submissionPath]: activeCode },
      testPath: bundle.testPath,
      pyDeps: meta.pyDeps,
    });
  };

  // Scratchpad: run the editor code as-is and show whatever it prints.
  const onRunCode = () => {
    if (busy) return;
    runner.runCode(activeCode);
  };

  const handleShowRef = async () => {
    if (refCode === null) {
      setRefLoading(true);
      try {
        const src = await fetchReferenceSolution(meta.bundlePath);
        setRefCode(src);
      } catch {
        // silently ignore — button stays disabled if fetch fails
        return;
      } finally {
        setRefLoading(false);
      }
    }
    setShowRef(true);
  };

  const onReset = () => {
    setCode(starter);
    localStorage.removeItem(storageKey);
    try {
      localStorage.removeItem(`mlp:solved:${meta.id}`);
    } catch {}
    setAllPassed(false);
    setShowRef(false);
    postedRef.current = null; // allow re-saving after a fresh solve
    if (!session?.user) return;
    // Wipe submissions + progress, THEN tell the sidebar to drop the ✓. We fire
    // the event only after the DELETE resolves so the sidebar's reconciling
    // refresh doesn't race the delete and re-add the badge.
    fetch(`/api/progress?problemId=${encodeURIComponent(meta.id)}`, {
      method: "DELETE",
    })
      .then(() => {
        window.dispatchEvent(
          new CustomEvent("mlp:progress-reset", { detail: { problemId: meta.id } }),
        );
      })
      .catch(() => {});
  };

  // Cmd/Ctrl+Enter to run, from anywhere on the page (incl. the editor).
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onRunRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Escape key handler to exit fullscreen mode, and Ctrl/Cmd +/-/0 for font zoom
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !e.isComposing) {
        setIsFullscreen(false);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setFontSize((prev) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev + 1)));
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setFontSize((prev) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev - 1)));
        } else if (e.key === "0") {
          e.preventDefault();
          setFontSize(DEFAULT_FONT_SIZE);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Mouse wheel and trackpad pinch zoom in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;
    const workspaceEl = workspaceRef.current;
    if (!workspaceEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();

      const isSmallDelta = Math.abs(e.deltaY) < 40;
      const factor = isSmallDelta ? 0.04 : 0.015;
      const delta = -e.deltaY * factor;

      setFontSize((prev) => {
        const next = prev + delta;
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
        return Math.round(clamped * 10) / 10;
      });
    };

    // Safari GestureEvent for Mac trackpad pinch
    let gestureStartSize = fontSizeRef.current;
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartSize = fontSizeRef.current;
    };
    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureEvent = e as unknown as { scale: number };
      if (typeof gestureEvent.scale === "number") {
        const next = gestureStartSize * gestureEvent.scale;
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
        setFontSize(Math.round(clamped * 10) / 10);
      }
    };
    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    // Touchscreen 2-finger pinch
    let touchStartDistance = 0;
    let touchStartSize = fontSizeRef.current;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        touchStartSize = fontSizeRef.current;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistance > 0) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const scale = currentDistance / touchStartDistance;
        const next = touchStartSize * scale;
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
        setFontSize(Math.round(clamped * 10) / 10);
      }
    };
    const handleTouchEnd = () => {
      touchStartDistance = 0;
    };

    workspaceEl.addEventListener("wheel", handleWheel, { passive: false });
    workspaceEl.addEventListener("gesturestart", handleGestureStart as EventListener, { passive: false });
    workspaceEl.addEventListener("gesturechange", handleGestureChange as EventListener, { passive: false });
    workspaceEl.addEventListener("gestureend", handleGestureEnd as EventListener, { passive: false });
    workspaceEl.addEventListener("touchstart", handleTouchStart, { passive: false });
    workspaceEl.addEventListener("touchmove", handleTouchMove, { passive: false });
    workspaceEl.addEventListener("touchend", handleTouchEnd);

    return () => {
      workspaceEl.removeEventListener("wheel", handleWheel);
      workspaceEl.removeEventListener("gesturestart", handleGestureStart as EventListener);
      workspaceEl.removeEventListener("gesturechange", handleGestureChange as EventListener);
      workspaceEl.removeEventListener("gestureend", handleGestureEnd as EventListener);
      workspaceEl.removeEventListener("touchstart", handleTouchStart);
      workspaceEl.removeEventListener("touchmove", handleTouchMove);
      workspaceEl.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isFullscreen]);

  // Lock body scroll when fullscreen is active; restore previous inline value on cleanup
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  if (!meta.webRunnable) {
    return (
      <div className="placeholder">
        This problem needs Python packages that don’t run in the browser yet, so
        it can’t be solved here. Clone the repo and run <code>pytest</code>{" "}
        locally.
      </div>
    );
  }

  return (
    <div
      ref={workspaceRef}
      className={`workspace${isFullscreen ? " fullscreen" : ""}`}
      style={isFullscreen ? ({ "--editor-font-size": `${fontSize}px` } as React.CSSProperties) : undefined}
    >
      <div className="toolbar">
        <button className="btn primary" onClick={onRun} disabled={busy || !bundle}>
          {runner.status === "loading"
            ? "Loading runtime…"
            : runner.status === "running" && runner.mode === "test"
              ? "Running…"
              : "Run tests"}
        </button>
        <button
          className="btn"
          onClick={onRunCode}
          disabled={busy}
          title="Run your code and see its output"
        >
          {runner.status === "running" && runner.mode === "code" ? "Running…" : "Run"}
        </button>
        <button className="btn" onClick={onReset} disabled={busy}>
          Reset
        </button>
        <button
          className="btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
        {isFullscreen && fontSize !== DEFAULT_FONT_SIZE && (
          <button
            className="btn"
            onClick={() => setFontSize(DEFAULT_FONT_SIZE)}
            title="Reset font zoom (Ctrl/Cmd + 0)"
            aria-label="Reset font zoom"
            style={{ fontSize: "0.82rem", padding: "0.25rem 0.5rem" }}
          >
            {Math.round((fontSize / DEFAULT_FONT_SIZE) * 100)}% ⟲
          </button>
        )}
        <kbd className="hint">⌘/Ctrl + ↵</kbd>
        {runner.status === "done" &&
          runner.mode === "test" &&
          (session?.user ? (
            <span className="muted">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved ✓"
                  : saveState === "error"
                    ? "Save failed"
                    : ""}
            </span>
          ) : (
            <span className="muted">Sign in to save progress</span>
          ))}
        {bundleError && (
          <span className="result-bad">Failed to load: {bundleError}</span>
        )}
      </div>

      <div className="workspace-main">
        <div className="editor-pane">
          {allPassed && (
            <div className="solution-tabs">
              <button
                className={`solution-tab${!showRef ? " active" : ""}`}
                onClick={() => setShowRef(false)}
              >
                Your solution
              </button>
              <button
                className={`solution-tab${showRef ? " active" : ""}`}
                onClick={handleShowRef}
                disabled={refLoading}
              >
                {refLoading ? "Loading…" : "Reference solution"}
              </button>
            </div>
          )}

          <CodeMirror
            value={activeCode}
            height={isFullscreen ? "100%" : "360px"}
            theme={theme}
            extensions={[python(), editorPadding, preserveIndentOnEnter]}
            onChange={showRef ? (v) => setRefCode(v) : setCode}
            className="editor-cm"
          />
        </div>

        <div className="output-pane">
          <div className={!isFullscreen && allPassed && nextTasks.length > 0 ? "editor-row" : "output-col"}>
            <div className={!isFullscreen && allPassed && nextTasks.length > 0 ? "editor-col" : ""}>
              {runner.mode === "code" ? (
                <CodeOutputPanel
                  status={runner.status}
                  error={runner.error}
                  result={runner.codeResult}
                  isFullscreen={isFullscreen}
                />
              ) : (
                <ResultsPanel
                  status={runner.status}
                  error={runner.error}
                  result={runner.result}
                  isFullscreen={isFullscreen}
                />
              )}
            </div>

            {allPassed && nextTasks.length > 0 && (
              <div className="next-tasks-panel">
                <h3>What&apos;s next?</h3>
                {nextTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/problems/${t.topic}/${t.slug}`}
                    className="next-task-card"
                  >
                    <span className={`badge ${t.difficulty}`}>{t.difficulty}</span>
                    <span>{t.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutputPlaceholder() {
  return (
    <div className="results placeholder-output">
      <p className="muted">
        Run tests (<kbd className="hint">⌘/Ctrl + ↵</kbd>) or Run scratchpad to see output here.
      </p>
    </div>
  );
}

function ResultsPanel({
  status,
  error,
  result,
  isFullscreen,
}: {
  status: RunnerStatus;
  error: string | null;
  result: RunResult | null;
  isFullscreen?: boolean;
}) {
  if (status === "loading")
    return (
      <p className="results muted">
        Loading the Python runtime (first run only)…
      </p>
    );
  if (status === "running")
    return <p className="results muted">Running tests…</p>;
  if (status === "timeout")
    return (
      <p className="results result-bad">
        ⏱ Timed out after 15s — likely an infinite loop. The runtime was
        restarted; fix the loop and run again.
      </p>
    );
  if (status === "error")
    return <p className="results result-bad">Runner error: {error}</p>;
  if (status !== "done" || !result) {
    if (isFullscreen) {
      return <OutputPlaceholder />;
    }
    return null;
  }

  const allPass = result.total > 0 && result.passed === result.total;
  return (
    <div className="results">
      <p className={allPass ? "result-good banner" : "result-bad banner"}>
        {allPass ? "🎉 " : "✗ "}
        {result.passed}/{result.total} tests passed
        <span className="muted"> · {result.durationMs} ms</span>
      </p>
      <ul className="test-list">
        {result.tests.map((t) => (
          <TestRow key={t.nodeid} test={t} />
        ))}
      </ul>
      {result.output && (
        <details className="raw-output">
          <summary>Raw pytest output</summary>
          <pre className="code trace">{result.output}</pre>
        </details>
      )}
    </div>
  );
}

function CodeOutputPanel({
  status,
  error,
  result,
  isFullscreen,
}: {
  status: RunnerStatus;
  error: string | null;
  result: CodeResult | null;
  isFullscreen?: boolean;
}) {
  if (status === "loading")
    return (
      <p className="results muted">
        Loading the Python runtime (first run only)…
      </p>
    );
  if (status === "running") return <p className="results muted">Running…</p>;
  if (status === "timeout")
    return (
      <p className="results result-bad">
        ⏱ Timed out after 15s — likely an infinite loop. The runtime was
        restarted; fix the loop and run again.
      </p>
    );
  if (status === "error")
    return <p className="results result-bad">Runner error: {error}</p>;
  if (status !== "done" || !result) {
    if (isFullscreen) {
      return <OutputPlaceholder />;
    }
    return null;
  }

  const empty = !result.output && !result.error;
  return (
    <div className="results">
      <p className="muted banner">
        Output<span className="muted"> · {result.durationMs} ms</span>
      </p>
      {result.output && <pre className="code trace">{result.output}</pre>}
      {result.error && (
        <pre className="code trace result-bad">{result.error}</pre>
      )}
      {empty && (
        <p className="muted">
          No output — add <code>print(...)</code> or call your function to see
          results.
        </p>
      )}
    </div>
  );
}

function TestRow({ test }: { test: TestResult }) {
  const icon =
    test.outcome === "passed" ? "✓" : test.outcome === "skipped" ? "•" : "✗";
  const cls = test.outcome === "passed" ? "result-good" : "result-bad";
  return (
    <li className="test-row">
      <span className={cls}>
        {icon} {test.name}
      </span>
      {test.detail && test.outcome !== "passed" && (
        <details>
          <summary>details</summary>
          <pre className="code trace">{test.detail}</pre>
        </details>
      )}
    </li>
  );
}
