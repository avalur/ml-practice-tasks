# Normalize Rows to Unit Length

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** medium

Implement `normalize_rows(X)`.

Given a 2D array `X` of shape `(m, n)`, return an array of the same shape
where each **row** is scaled to unit L2 norm (`row / ||row||`). Assume no
row is all zeros. Vectorize with broadcasting — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/normalize_rows
```
Edit `submission.py` until every test passes.
