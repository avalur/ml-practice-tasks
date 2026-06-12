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

  // Resolve the editor's initial content once, with precedence:
  //   ?submission=<id>  →  local draft (your in-progress edits here)  →
  //   your last submission for this task  →  the starter stub.
  const hydratedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    const finish = (value?: string) => {
      if (!alive) return;
      if (typeof value === "string") setCode(value);
      hydratedRef.current = true; // enable the autosave below
    };

    const subId = new URLSearchParams(window.location.search).get("submission");
    if (subId) {
      // Explicit submission from the profile: load it, then drop the param so a
      // refresh keeps later edits instead of reloading it.
      fetch(`/api/submissions/${subId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.code === "string") {
            finish(d.code);
            window.history.replaceState(null, "", window.location.pathname);
          } else finish();
        })
        .catch(() => finish());
      return () => {
        alive = false;
      };
    }

    const draft = localStorage.getItem(storageKey);
    if (draft != null && draft !== starter) {
      finish(draft); // unsaved local edits win
      return () => {
        alive = false;
      };
    }

    // No local edits → prefill from the user's last submission (the API returns
    // null when logged out or never submitted), else keep the stub.
    fetch(`/api/submissions/latest?problemId=${encodeURIComponent(meta.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => finish(typeof d?.code === "string" ? d.code : undefined))
      .catch(() => finish());
    return () => {
      alive = false;
    };
  }, [storageKey, starter, meta.id]);

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
    if (!session?.user) return;
    const allPass = r.total > 0 && r.passed === r.total;
    if (allPass) {
      setAllPassed(true);
      onSolve?.();
    }
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
  }, [runner.status, runner.mode, runner.result, session, meta.id, code]);

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
    if (!showRef && refCode === null) {
      setRefLoading(true);
      try {
        const src = await fetchReferenceSolution(meta.bundlePath);
        setRefCode(src);
      } catch {
        // silently ignore — button stays disabled if fetch fails
      } finally {
        setRefLoading(false);
      }
    }
    setShowRef((v) => !v);
  };

  const onReset = () => {
    setCode(starter);
    localStorage.removeItem(storageKey);
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
    <div className="workspace">
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
        height="360px"
        theme={theme}
        extensions={[python(), editorPadding, preserveIndentOnEnter]}
        onChange={showRef ? (v) => setRefCode(v) : setCode}
      />

      <div className={allPassed && nextTasks.length > 0 ? "editor-row" : ""}>
        <div className={allPassed && nextTasks.length > 0 ? "editor-col" : ""}>
          {runner.mode === "code" ? (
            <CodeOutputPanel
              status={runner.status}
              error={runner.error}
              result={runner.codeResult}
            />
          ) : (
            <ResultsPanel
              status={runner.status}
              error={runner.error}
              result={runner.result}
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
  );
}

function ResultsPanel({
  status,
  error,
  result,
}: {
  status: RunnerStatus;
  error: string | null;
  result: RunResult | null;
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
  if (status !== "done" || !result) return null;

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
}: {
  status: RunnerStatus;
  error: string | null;
  result: CodeResult | null;
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
  if (status !== "done" || !result) return null;

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
