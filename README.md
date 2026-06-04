# ml-practice-tasks

LeetCode-style practice problems for machine learning in Python. Each task ships
with a clear statement and a pytest suite — implement the function until the
tests go green. The goal is to practice writing ML code *by hand*, so most tasks
forbid the obvious ready-made helpers (e.g. `sklearn`, `scipy`).

## For students

```bash
pip install -r requirements.txt
pytest tasks/numpy_basics/pairwise_distances   # pick any task
```

Open the task's `README.md` for the statement and constraints, edit
`submission.py`, and re-run the tests.

## Layout

```
problems/<topic>/<slug>/   # source of truth (reference solution + tests + meta)
tasks/<topic>/<slug>/      # generated student stubs — solve these
tools/                     # shared helpers (banned-construct checks)
generate.py                # builds tasks/ from problems/
```

## For authors

A problem lives in `problems/<topic>/<slug>/`:

- `reference.py` — the reference solution; the body between
  `# --- solution: begin ---` / `# --- solution: end ---` is stripped to make
  the student stub.
- `test.py` — pytest tests. Use the `impl` fixture to call the implementation,
  `rng_for(seed)` for deterministic randomness, and `assert_clean(impl_source,
  banned)` to enforce constraints.
- `meta.py` — a `META` dict: title, topic, difficulty, statement, and `banned`
  (`modules`, `names`, `loops`).

After editing `problems/`, regenerate the student tree:

```bash
python generate.py          # rebuild tasks/
python generate.py --check  # CI: verify tasks/ is up to date
pytest problems             # CI: reference solutions must pass
```
