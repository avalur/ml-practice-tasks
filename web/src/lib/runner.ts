// Client-side runner types + helpers shared by the worker hook and the UI.
import type { ProblemMeta } from "./problem";

export type TestOutcome = "passed" | "failed" | "error" | "skipped";

export type TestResult = {
  nodeid: string;
  name: string;
  outcome: TestOutcome;
  detail: string;
};

export type RunResult = {
  exit: number;
  passed: number;
  total: number;
  tests: TestResult[];
  durationMs: number;
  output: string;
};

// Result of the scratchpad "Run" button: execute the editor code as a script
// and capture what it printed.
export type CodeResult = {
  output: string; // combined stdout + stderr
  error: string; // traceback if an exception escaped
  durationMs: number;
};

export type RunnerStatus =
  | "loading" // pyodide + packages downloading
  | "ready"
  | "running"
  | "done"
  | "timeout"
  | "error";

// Shared harness files mounted at the /task root, fetched from the static bundle.
const SHARED: ReadonlyArray<readonly [url: string, dest: string]> = [
  ["/content/_shared/conftest.py", "conftest.py"],
  ["/content/_shared/pytest.ini", "pytest.ini"],
  ["/content/_shared/tools/__init__.py", "tools/__init__.py"],
  ["/content/_shared/tools/checks.py", "tools/checks.py"],
];

export type Bundle = {
  files: Record<string, string>; // /task-relative path -> contents (excl. submission)
  taskDir: string; // e.g. "problems/numpy_basics/pairwise_distances"
  submissionPath: string; // taskDir + "/submission.py"
  testPath: string; // taskDir + "/test.py"
};

/** Fetch the static harness + problem files for a problem (everything but the
 *  student's submission). Throws if any file is missing. */
export async function loadBundle(meta: ProblemMeta): Promise<Bundle> {
  const taskDir = `problems/${meta.topic}/${meta.slug}`;
  const entries: Array<readonly [string, string]> = [
    ...SHARED,
    [`${meta.bundlePath}/test.py`, `${taskDir}/test.py`],
    [`${meta.bundlePath}/meta.py`, `${taskDir}/meta.py`],
  ];
  const files: Record<string, string> = {};
  await Promise.all(
    entries.map(async ([url, dest]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
      files[dest] = await res.text();
    }),
  );
  return {
    files,
    taskDir,
    submissionPath: `${taskDir}/submission.py`,
    testPath: `${taskDir}/test.py`,
  };
}
