# Sort Rows by a Column

**Topic:** `numpy_indexing` &nbsp;|&nbsp; **Difficulty:** medium

Implement `sort_by_column(X, k)`.

Given a 2D array `X` and a column index `k`, return `X` with its **rows**
reordered so that column `k` is ascending. Use `argsort` + fancy indexing —
no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_indexing/sort_by_column
```
Edit `submission.py` until every test passes.
