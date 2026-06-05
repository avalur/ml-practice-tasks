"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import type { ProblemMeta } from "@/lib/problem";
import { loadBundle, type Bundle, type TestResult } from "@/lib/runner";
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

  if (!meta.webRunnable) {
    return (
      <div className="placeholder">
        This problem needs Python packages that don’t run in the browser yet, so
        it can’t be solved here. Clone the repo and run <code>pytest</code>{" "}
        locally.
      </div>
    );
  }

  const busy = runner.status === "running" || runner.status === "loading";

  const onRun = () => {
    if (!bundle) return;
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
        {bundleError && <span className="result-bad">Failed to load: {bundleError}</span>}
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
  status: ReturnType<typeof usePyodideRunner>["status"];
  error: string | null;
  result: ReturnType<typeof usePyodideRunner>["result"];
}) {
  if (status === "loading")
    return (
      <p className="results muted">
        Loading the Python runtime (first time downloads a few MB)…
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
      <p className={allPass ? "result-good" : "result-bad"}>
        {allPass ? "✓ " : "✗ "}
        {result.passed}/{result.total} tests passed
        <span className="muted"> · {result.durationMs} ms</span>
      </p>
      <ul className="test-list">
        {result.tests.map((t) => (
          <TestRow key={t.nodeid} test={t} />
        ))}
      </ul>
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
