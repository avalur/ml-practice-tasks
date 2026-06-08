/* Classic Web Worker that runs a problem's pytest suite under Pyodide.
 *
 * Served as a static asset (not webpack-bundled) so it can importScripts the
 * Pyodide loader from the CDN. Ported from spikes/pyodide-runner (Phase 0a),
 * which proved this approach: build the repo import topology in a /task FS,
 * purge stale modules between runs, run pytest.main(), capture structured
 * results via a logreport plugin.
 *
 * Protocol (postMessage):
 *   in:  { type: "INIT", pyDeps }
 *        { type: "RUN", runId, files, testPath, pyDeps }   // run the pytest suite
 *        { type: "RUN_CODE", runId, code, pyDeps }         // run editor code, capture output
 *   out: { type: "STATUS", stage }            // loading-pyodide | loading-packages
 *        { type: "READY" }
 *        { type: "RESULT", runId, result }        // pytest results
 *        { type: "CODE_RESULT", runId, result }   // { output, error, durationMs }
 *        { type: "ERROR", runId?, error }
 */

// Pyodide 0.29.4 is vendored under web/public/pyodide (see export note), so the
// runtime is served same-origin — no CDN dependency at runtime.
const BASE = "/pyodide/";

importScripts(`${BASE}pyodide.js`);

// Python harness — defines _run_once(files, test_path) → structured results.
const HARNESS = `
import sys, os, io, json, importlib, pathlib, shutil, time, contextlib, traceback

def _purge_task_modules():
    for name in list(sys.modules):
        m = sys.modules.get(name)
        f = getattr(m, "__file__", None) or ""
        if isinstance(f, str) and f.startswith("/task"):
            sys.modules.pop(name, None)
    importlib.invalidate_caches()

def _run_once(files, test_path):
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
        def pytest_runtest_logreport(self, report):
            reports.append({
                "nodeid": report.nodeid,
                "when": report.when,
                "outcome": report.outcome,
                "longrepr": (str(report.longrepr) if report.longrepr else ""),
            })
    buf = io.StringIO()
    t0 = time.time()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        code = pytest.main(
            ["-q", "-p", "no:cacheprovider", "/task/" + test_path],
            plugins=[_Collector()],
        )
    dt = int((time.time() - t0) * 1000)

    # One row per test: prefer the call outcome; otherwise a setup/teardown error.
    by_id = {}
    for r in reports:
        nid = r["nodeid"]
        if r["when"] == "call":
            by_id[nid] = {"nodeid": nid, "name": nid.split("::")[-1],
                          "outcome": r["outcome"], "detail": r["longrepr"]}
        elif r["when"] in ("setup", "teardown") and r["outcome"] != "passed" and nid not in by_id:
            by_id[nid] = {"nodeid": nid, "name": nid.split("::")[-1],
                          "outcome": "error", "detail": r["longrepr"]}
    tests = list(by_id.values())
    passed = sum(1 for t in tests if t["outcome"] == "passed")
    return {
        "exit": int(code),
        "passed": passed,
        "total": len(tests),
        "tests": tests,
        "durationMs": dt,
        "output": buf.getvalue()[-3000:],
    }

def _run_code(code):
    # Scratchpad: run the editor content as a __main__ script, capturing
    # stdout+stderr. A fresh globals dict each call so runs don't leak state.
    os.chdir("/")
    out = io.StringIO()
    err_text = ""
    g = {"__name__": "__main__", "__file__": "submission.py"}
    t0 = time.time()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            exec(compile(code, "submission.py", "exec"), g)
        except SystemExit:
            pass
        except BaseException:
            err_text = traceback.format_exc()
    dt = int((time.time() - t0) * 1000)
    return {
        "output": out.getvalue()[-20000:],
        "error": err_text[-8000:],
        "durationMs": dt,
    }
`;

let pyodidePromise = null;

function ensurePyodide(pyDeps) {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      self.postMessage({ type: "STATUS", stage: "loading-pyodide" });
      const pyodide = await loadPyodide({ indexURL: BASE });
      self.postMessage({ type: "STATUS", stage: "loading-packages" });
      const pkgs = [...new Set(["pytest", ...(pyDeps || ["numpy"])])];
      await pyodide.loadPackage(pkgs, { messageCallback: () => {} });
      pyodide.runPython(HARNESS);
      return pyodide;
    })();
  }
  return pyodidePromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "INIT") {
      await ensurePyodide(msg.pyDeps);
      self.postMessage({ type: "READY" });
      return;
    }
    if (msg.type === "RUN") {
      const pyodide = await ensurePyodide(msg.pyDeps);
      // Load any extra per-problem packages (cached if already present).
      await pyodide.loadPackage(
        [...new Set(["pytest", ...(msg.pyDeps || ["numpy"])])],
        { messageCallback: () => {} },
      );
      pyodide.globals.set("FILES_JSON", JSON.stringify(msg.files));
      pyodide.globals.set("TEST_PATH", msg.testPath);
      const out = pyodide.runPython(
        "json.dumps(_run_once(json.loads(FILES_JSON), TEST_PATH))",
      );
      self.postMessage({ type: "RESULT", runId: msg.runId, result: JSON.parse(out) });
    }
    if (msg.type === "RUN_CODE") {
      const pyodide = await ensurePyodide(msg.pyDeps);
      await pyodide.loadPackage([...new Set(msg.pyDeps || ["numpy"])], {
        messageCallback: () => {},
      });
      pyodide.globals.set("USER_CODE", msg.code);
      const out = pyodide.runPython("json.dumps(_run_code(USER_CODE))");
      self.postMessage({ type: "CODE_RESULT", runId: msg.runId, result: JSON.parse(out) });
    }
  } catch (err) {
    self.postMessage({
      type: "ERROR",
      runId: msg.runId,
      error: String((err && err.message) || err),
    });
  }
};
