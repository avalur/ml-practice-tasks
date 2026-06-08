"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeResult, RunResult, RunnerStatus } from "@/lib/runner";

const TIMEOUT_MS = 15000;

export type RunPayload = {
  files: Record<string, string>;
  testPath: string;
  pyDeps: string[];
};

/**
 * Owns a single Pyodide Web Worker. Loads the runtime once (warmed on mount),
 * runs submissions, and enforces a hard timeout by terminating + respawning the
 * worker (WASM can't be interrupted). Stale results from a terminated/older run
 * are dropped via a monotonic run id.
 */
export function usePyodideRunner(pyDeps: string[]) {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pyDepsRef = useRef(pyDeps);
  pyDepsRef.current = pyDeps;

  const [status, setStatus] = useState<RunnerStatus>("loading");
  const [mode, setMode] = useState<"test" | "code" | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(() => {
    const w = new Worker("/pyodide-worker.js");
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data || {};
      if (msg.type === "READY") {
        setStatus((s) => (s === "running" ? s : "ready"));
      } else if (msg.type === "RESULT") {
        if (msg.runId !== runIdRef.current) return; // stale run
        if (timerRef.current) clearTimeout(timerRef.current);
        setResult(msg.result as RunResult);
        setError(null);
        setStatus("done");
      } else if (msg.type === "CODE_RESULT") {
        if (msg.runId !== runIdRef.current) return; // stale run
        if (timerRef.current) clearTimeout(timerRef.current);
        setCodeResult(msg.result as CodeResult);
        setError(null);
        setStatus("done");
      } else if (msg.type === "ERROR") {
        if (msg.runId != null && msg.runId !== runIdRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        setError(msg.error || "runner error");
        setStatus("error");
      }
    };
    w.onerror = (e) => {
      setError(e.message || "worker crashed");
      setStatus("error");
    };
    workerRef.current = w;
    w.postMessage({ type: "INIT", pyDeps: pyDepsRef.current });
    return w;
  }, []);

  useEffect(() => {
    spawn();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [spawn]);

  // Shared run setup: ensure a worker, bump the run id, set the busy state and
  // arm the watchdog. Returns the new run id for the caller's postMessage.
  const begin = useCallback(() => {
    if (!workerRef.current) spawn();
    const runId = ++runIdRef.current;
    setStatus("running");
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      workerRef.current?.terminate();
      workerRef.current = null;
      setStatus("timeout");
      spawn(); // fresh runtime for the next attempt
    }, TIMEOUT_MS);
    return runId;
  }, [spawn]);

  // Run the pytest suite.
  const run = useCallback(
    (payload: RunPayload) => {
      const runId = begin();
      setMode("test");
      setResult(null);
      workerRef.current!.postMessage({ type: "RUN", runId, ...payload });
    },
    [begin],
  );

  // Run the editor code as a script and capture its output (scratchpad).
  const runCode = useCallback(
    (code: string) => {
      const runId = begin();
      setMode("code");
      setCodeResult(null);
      workerRef.current!.postMessage({
        type: "RUN_CODE",
        runId,
        code,
        pyDeps: pyDepsRef.current,
      });
    },
    [begin],
  );

  return { status, mode, result, codeResult, error, run, runCode };
}
