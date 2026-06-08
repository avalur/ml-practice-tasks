# Read-Only Array

**Topic:** `numpy_basics` &nbsp;|&nbsp; **Difficulty:** medium

Implement `make_immutable(a)`.

Return the array `a` made **read-only**: its values stay the same, but any
attempt to assign into the result (e.g. `result[0] = 1`) must raise. (NumPy
arrays expose a `flags.writeable` flag for exactly this.)

## How to run

```bash
pytest tasks/numpy_basics/make_immutable
```
Edit `submission.py` until every test passes.
