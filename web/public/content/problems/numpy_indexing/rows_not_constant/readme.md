# Rows That Are Not Constant

**Topic:** `numpy_indexing` &nbsp;|&nbsp; **Difficulty:** medium

Implement `rows_not_constant(X)`.

Given a 2D array `X`, return the sub-array of rows that are **not** constant
(rows whose values are not all equal), preserving their order. Use a boolean
row mask — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_indexing/rows_not_constant
```
Edit `submission.py` until every test passes.
