# Inverse of bincount

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

Implement `repeat_counts(counts)`.

Given a 1D non-negative integer array `counts`, return a 1D array in which
index `i` appears `counts[i]` times, in order. For example
`counts = [2, 0, 3]` → `[0, 0, 2, 2, 2]`. (This is the inverse of
`np.bincount`.) No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/repeat_counts
```
Edit `submission.py` until every test passes.
