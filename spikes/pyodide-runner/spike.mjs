// Phase 0a spike — prove the Pyodide runner core in Node.
//
// Loads numpy + pytest under Pyodide, reproduces the repo's import topology in a
// virtual /task FS, and runs the REAL pairwise_distances test suite via
// pytest.main() — repeatedly, in one interpreter — to check:
//   * a correct solution passes all tests,
//   * a wrong solution fails the numeric tests,
//   * a banned for-loop trips test_no_banned_constructs,
//   * a syntax-error submission surfaces as errors (not a crash),
//   * NO state leakage: a correct run after a failing run still fully passes.
//
// The infinite-loop/timeout case is intentionally out of scope here — that needs
// worker termination and belongs to the browser spike (Step 2).

import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "../../");
const PROB = "problems/numpy_basics/pairwise_distances";
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

// Files shared by every run (mirror the repo layout under /task).
const SHARED = {
  "conftest.py": read("conftest.py"),
  "pytest.ini": read("pytest.ini"),
  "tools/__init__.py": read("tools/__init__.py"),
  "tools/checks.py": read("tools/checks.py"),
  [`${PROB}/test.py`]: read(`${PROB}/test.py`),
  [`${PROB}/meta.py`]: read(`${PROB}/meta.py`),
};

// Candidate submissions exercising each outcome.
const SUBMISSIONS = {
  correct: read(`${PROB}/reference.py`), // reference is a valid submission.py
  failing:
    "import numpy as np\n\n\n" +
    "def pairwise_distances(x, y):\n" +
    "    return np.zeros((x.shape[0], y.shape[0]))\n",
  banned_loop:
    "import numpy as np\n\n\n" +
    "def pairwise_distances(x, y):\n" +
    "    out = np.empty((x.shape[0], y.shape[0]))\n" +
    "    for i in range(x.shape[0]):\n" +
    "        for j in range(y.shape[0]):\n" +
    "            out[i, j] = np.sqrt(((x[i] - y[j]) ** 2).sum())\n" +
    "    return out\n",
  syntax_error:
    "import numpy as np\n\n\n" +
    "def pairwise_distances(x, y):\n" +
    "    return np.sqrt((\n", // deliberately unbalanced
};

// Python harness: (re)build the /task tree, purge stale modules, run pytest,
// and report structured results captured via a pytest plugin.
const HARNESS = `
import sys, os, io, json, importlib, pathlib, shutil, time, contextlib

def _purge_task_modules():
    for name in list(sys.modules):
        m = sys.modules.get(name)
        f = getattr(m, "__file__", None) or ""
        if isinstance(f, str) and f.startswith("/task"):
            sys.modules.pop(name, None)
    importlib.invalidate_caches()

def run_once(files):
    os.chdir("/")  # never sit inside /task while we delete it
    if os.path.exists("/task"):
        shutil.rmtree("/task")
    for rel, content in files.items():
        p = pathlib.Path("/task") / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    os.chdir("/task")
    if "/task" not in sys.path:
        sys.path.insert(0, "/task")
    _purge_task_modules()

    import pytest
    reports = []
    class _Collector:
        # capture every phase; a fixture failure is when="setup", outcome="failed"
        def pytest_runtest_logreport(self, report):
            reports.append({
                "nodeid": report.nodeid,
                "when": report.when,
                "outcome": report.outcome,
            })
    buf = io.StringIO()
    t0 = time.time()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        code = pytest.main(
            # explicit test FILE: robust regardless of pytest's python_files glob
            ["-q", "-p", "no:cacheprovider", "/task/problems/numpy_basics/pairwise_distances/test.py"],
            plugins=[_Collector()],
        )
    dt = int((time.time() - t0) * 1000)

    call = [r for r in reports if r["when"] == "call"]
    passed = sorted({r["nodeid"] for r in call if r["outcome"] == "passed"})
    failed = sorted({r["nodeid"] for r in call if r["outcome"] == "failed"})
    # errored = failed/errored during setup or teardown (e.g. SyntaxError on import)
    errored = sorted({
        r["nodeid"] for r in reports
        if r["when"] in ("setup", "teardown") and r["outcome"] != "passed"
    })
    return {
        "exit": int(code),
        "passed": len(passed),
        "callTotal": len(call),
        "failed": [n.split("::")[-1] for n in failed],
        "errored": [n.split("::")[-1] for n in errored],
        "durationMs": dt,
        "report": buf.getvalue()[-600:],  # tail of captured pytest output
    }
`;

function shortName(key) {
  return key.padEnd(13);
}

async function main() {
  const t0 = Date.now();
  console.log("loading pyodide…");
  const pyodide = await loadPyodide();
  console.log(`pyodide ${pyodide.version} loaded in ${Date.now() - t0}ms`);

  const tp = Date.now();
  await pyodide.loadPackage(["numpy", "pytest"], { messageCallback: () => {} });
  console.log(`numpy+pytest loaded in ${Date.now() - tp}ms`);

  await pyodide.runPythonAsync(HARNESS);

  const runOnce = (submissionKey) => {
    const files = { ...SHARED, [`${PROB}/submission.py`]: SUBMISSIONS[submissionKey] };
    pyodide.globals.set("FILES_JSON", JSON.stringify(files));
    const out = pyodide.runPython("json.dumps(run_once(json.loads(FILES_JSON)))");
    return JSON.parse(out);
  };

  // Run order deliberately interleaves outcomes to flush out state leakage.
  const order = [
    "correct",
    "failing",
    "correct",
    "banned_loop",
    "syntax_error",
    "correct",
  ];

  console.log("\nscenario      exit  passed/total  failed/errored                         ms");
  console.log("-".repeat(86));
  const results = [];
  for (const key of order) {
    const r = runOnce(key);
    results.push([key, r]);
    const fe = [
      ...r.failed.map((n) => "F:" + n),
      ...r.errored.map((n) => "E:" + n),
    ].join(" ") || "—";
    console.log(
      `${shortName(key)} ${String(r.exit).padStart(3)}   ${String(r.passed).padStart(2)}/${String(r.callTotal).padEnd(2)}        ${fe.padEnd(38)} ${String(r.durationMs).padStart(5)}`
    );
  }

  // Assertions — this is what makes the spike a real proof, not just a print.
  const checks = [];
  const correctRuns = results.filter(([k]) => k === "correct").map(([, r]) => r);
  checks.push([
    "correct always fully passes (no leakage)",
    correctRuns.every((r) => r.passed === r.callTotal && r.callTotal > 0 && r.failed.length === 0 && r.errored.length === 0),
  ]);
  const failing = results.find(([k]) => k === "failing")[1];
  checks.push(["failing fails ≥1 numeric test", failing.failed.length >= 1]);
  const banned = results.find(([k]) => k === "banned_loop")[1];
  checks.push([
    "banned_loop trips test_no_banned_constructs",
    banned.failed.includes("test_no_banned_constructs"),
  ]);
  const syntax = results.find(([k]) => k === "syntax_error")[1];
  checks.push(["syntax_error surfaces as error(s), no crash", syntax.errored.length >= 1]);

  console.log("\nassertions:");
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
    ok = ok && pass;
  }
  console.log(`\nSPIKE ${ok ? "PASSED ✅" : "FAILED ❌"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("spike crashed:", e);
  process.exit(2);
});
