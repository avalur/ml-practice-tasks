"use client";

import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import type { ProblemMeta } from "@/lib/problem";
import {
  loadBundle,
  type Bundle,
  type RunResult,
  type RunnerStatus,
  type TestResult,
} from "@/lib/runner";
import { usePyodideRunner } from "@/hooks/usePyodideRunner";

export function SolveWorkspace({
  meta,
  starter,
}: {
  meta: ProblemMeta;
  starter: string;
}) {
  const storageKey = `mlp:code:${meta.id}`;
  const [code, setCode] = useState(starter);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const runner = usePyodideRunner(meta.pyDeps);

  // Restore saved code after mount (init with starter to avoid hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved != null) setCode(saved);
  }, [storageKey]);

  // Autosave.
  useEffect(() => {
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

  const busy = runner.status === "running" || runner.status === "loading";

  const onRun = () => {
    if (busy || !bundle) return;
    runner.run({
      files: { ...bundle.files, [bundle.submissionPath]: code },
      testPath: bundle.testPath,
      pyDeps: meta.pyDeps,
    });
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
            : runner.status === "running"
              ? "Running…"
              : "Run tests"}
        </button>
        <button className="btn" onClick={onReset} disabled={busy}>
          Reset
        </button>
        <kbd className="hint">⌘/Ctrl + ↵</kbd>
        {bundleError && (
          <span className="result-bad">Failed to load: {bundleError}</span>
        )}
      </div>

      <CodeMirror
        value={code}
        height="360px"
        theme="dark"
        extensions={[python()]}
        onChange={setCode}
      />

      <ResultsPanel
        status={runner.status}
        error={runner.error}
        result={runner.result}
      />
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
  if (status !== "done" || !result)
    return <p className="results muted">Write your solution and run the tests.</p>;

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
          <pre className="code">{result.output}</pre>
        </details>
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
          <pre className="code">{test.detail}</pre>
        </details>
      )}
    </li>
  );
}
