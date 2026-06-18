# PI.md — Context for pi agent

Read this first. It encodes the repo structure and conventions so I don't
re-derive them on every session.

## What this repo is

"LeetCode for ML": small Python ML tasks students solve **by hand** (no AI,
no ready-made helpers) and verify with pytest. Companion to the course at
https://avalur.github.io/mlcourse. Author/owner: Alexander Avdiushenko
(`avalur`). He chats in Russian but **all repo artifacts are in English**.

There are **four task families**:
- **`numpy_*`** — ML/NumPy track (broadcasting, indexing, linalg, etc.)
- **`py_*`** — Python fundamentals (comprehensions, decorators, generators, OOP)
  re-authored from the manytask course `gitlab.manytask.org/python/public-2025-fall`
- **`pandas_*`** — DataFrame/Series operations (columns, indexing, groupby, merge)
- **Brainteasers** — interactive logic/math puzzles, live in `web/src/app/brainteasers/`
  (not part of the pytest pipeline)

## Architecture (don't break these invariants)

- **Source of truth = `problems/<topic>/<slug>/`.** Never hand-edit `tasks/`.
  - `reference.py` — working solution. Body between
    `# --- solution: begin ---` and `# --- solution: end ---` is stripped to
    make the student stub. Everything else (imports, signature, docstring) is
    kept verbatim — put full problem context in the docstring.
  - `test.py` — pytest. Runs against BOTH trees via the `impl` fixture.
  - `meta.py` — a `META` dict: required `title`, `topic`, `difficulty`
    (easy/medium/hard), `entry`, `statement`; optional `banned`, `hints`,
    `order` (within-topic sort, default 100), `py_deps` (default `["numpy"]`;
    `[]` for pure-Python), `hidden`.

- **`tasks/<topic>/<slug>/` is generated** by `generate.py` (submission stub +
  copied test.py/meta.py + rendered README.md). Regenerate after any edit.

- **Constraints are enforced statically** by `tools/checks.py` via `ast`.
  `banned` keys: `modules` (import roots, e.g. `scipy`, `sklearn`),
  `names` (identifiers/attrs, e.g. `cdist`, `norm`; also covers builtins like
  `sum`/`set`/`sorted`/`reversed`), `loops` (truthy → no `for`/`while`),
  `operators` (subset of `{"in", "not in"}` — membership),
  `slicing` (truthy → no `seq[a:b]`; plain indexing `seq[i]` is fine).
  The `assert_clean(impl_source, banned)` check only inspects the student's
  source — test code is trusted.

## Fixtures available in test.py (from `conftest.py`)

- `impl` — the loaded implementation module; call `impl.<entry>(...)`.
- `impl_source` — its source text (pass to `assert_clean`).
- `banned` — the `banned` dict from meta.py.
- `rng_for` — factory: `rng = rng_for(seed)` → seeded `np.random.default_rng`.
  Always seed randomness so tests are deterministic.

## Problem topics (source of truth)

```
problems/
├── numpy_warmup      — basic numpy ops (shape, dtype, indexing basics)
├── numpy_indexing    — advanced indexing & slicing
├── numpy_reductions  — sum, mean, argmax, etc. (vectorized)
├── numpy_linalg      — linear algebra (det, inv, eig, etc.)
├── numpy_manipulation— reshape, stack, tile, broadcast
├── numpy_combine     — chaining multiple operations
├── numpy_basics      — general fundamentals (template task)

├── py_basics         — Python basics
├── py_datastructures — lists, dicts, sets, tuples
├── py_functional     — map/filter/reduce, lambdas
├── py_strings        — string manipulation
├── py_classes        — OOP, classes, inheritance

├── pandas_basics     — DataFrame/Series basics
├── pandas_exploration  — data exploration (filter_rows, groupby_agg, sort_rows)
└── pandas_manipulation — DataFrame manipulation (clean_data, merge_join, multiindex_unstack, xs_select)
```

## Brainteasers (separate from the pytest pipeline)

Interactive logic/math puzzles with their own UI. **Not** in `problems/`, no
`generate.py`, no pytest, no student stubs.

```
web/src/app/brainteasers/
├── page.tsx              ← hardcoded list of teasers (slug, title, difficulty)
├── alzheimer-math/       — arrange digit/operator tiles into valid equations
└── complete-the-integral/ — place three numbers so ∫ₐᵇ x dx = c
```

Each teaser has its own subdirectory with UI components. They are **not**
Python tasks — they're interactive puzzles rendered by the Next.js frontend.

## Commands

```bash
python generate.py            # rebuild tasks/ from problems/
python generate.py --check    # CI: fail if tasks/ drifted from problems/
pytest problems -q            # CI: all reference solutions must pass
pytest tasks/<topic>/<slug>   # run a student stub
```

CI (`.github/workflows/ci.yml`) runs the `--check` + `pytest problems` pair on
push/PR. **Always regenerate and run `pytest problems` before committing.**

## Recipe: add a new task

1. `mkdir -p problems/<topic>/<slug>` and create `reference.py`, `test.py`,
   `meta.py` (copy `problems/numpy_basics/pairwise_distances/` as template).
2. In `reference.py`: full docstring (survives into stub), real solution wrapped
   in `# --- solution: begin/end ---` markers.
3. In `test.py`: trusted oracle (brute force is fine) + parametrized seeds via
   `rng_for`, plus a `test_no_banned_constructs(impl_source, banned)`.
4. In `meta.py`: fill `META`, especially `banned` for the concept being taught
   (ban the shortcut that would trivialize it).
5. `python generate.py` to build `tasks/`.
6. Verify: `pytest problems/<topic>/<slug>` (reference green) and
   `pytest tasks/<topic>/<slug>` (stub should fail with NotImplementedError).

## Design principles for good tasks

- One concept per task; solvable by hand without AI.
- Ban the helper that would make it a one-liner so the student writes the
  mechanics (e.g. forbid `sklearn`/`scipy`; forbid loops when vectorization is
  the lesson).
- Deterministic tests; compare against an independent oracle, not a copy of
  the reference solution.

## Key files at a glance

| File | Purpose |
|---|---|
| `generate.py` | Generates `tasks/` from `problems/` |
| `conftest.py` | Pytest fixtures (`impl`, `rng_for`, `banned`) |
| `tools/checks.py` | AST-based banned construct enforcement |
| `pytest.ini` | Pytest config (rootdir, pythonpath) |
| `requirements.txt` | Python deps (numpy, pytest, etc.) |
| `web/` | Next.js frontend platform for completing tasks |
