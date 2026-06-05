# Pyodide runner spike (Phase 0a)

Throwaway de-risking spike for the website plan (`docs/website-plan.md`). It proves
the **core unknown**: can we run the repo's real `pytest` suite (with `numpy`) for a
problem entirely under Pyodide, repeatably and in isolation, and capture structured
results?

This is the **Node** step (Step 1). It exercises the actual repo files
(`conftest.py`, `tools/checks.py`, `pytest.ini`, `problems/numpy_basics/pairwise_distances/{test.py,meta.py}`)
— it does not copy logic. The **browser** step (worker, first-load weight,
timeout-by-termination) is separate and not covered here.

## Run

```bash
npm install        # pulls pyodide; numpy/pytest wheels are fetched + cached on first run
npm run spike
```

Expected: `SPIKE PASSED ✅`, with a results table for correct / failing /
banned-loop / syntax-error submissions, interleaved with repeated `correct` runs to
prove there is **no state leakage** across `pytest.main()` calls in one interpreter.

## What it validated

- `pyodide.loadPackage(["numpy","pytest"])` works; `pytest.main()` runs the suite.
- The repo import topology is reproduced by writing files into a `/task` FS and
  `chdir`-ing there (`pythonpath = .`), plus a defensive `sys.path` insert.
- Isolation across runs = purge every module whose `__file__` is under `/task` +
  `importlib.invalidate_caches()` + recreate the FS each run.
- Structured per-test results captured via a `pytest_runtest_logreport` plugin
  (no stdout parsing); fixture/import failures show up as `setup` errors, not crashes.
- Warm rerun latency is tens of ms after the one-time Pyodide + package load.

## Bug this surfaced

The problem test file is named `test.py`, which pytest's default `python_files`
glob (`test_*.py` / `*_test.py`) does **not** match. Running a *directory*
(`pytest problems`, as CI and the README did) collected **zero** tests. Fixed by
adding `python_files = test.py ...` to the repo `pytest.ini`. The runner itself
invokes pytest on the explicit test file, so it is robust regardless.
