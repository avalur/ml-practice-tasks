# Subtract Each Row's Mean

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

Implement `row_demean(X)`.

Given a 2D array `X` of shape `(m, n)`, return an array of the same shape
where the mean of each **row** has been subtracted from that row. Vectorize
it with broadcasting — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/row_demean
```
Edit `submission.py` until every test passes.
