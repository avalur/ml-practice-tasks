# Negate Values in a Range

**Topic:** `numpy_indexing` &nbsp;|&nbsp; **Difficulty:** medium

Implement `mask_negate(x, lo, hi)`.

Given a 1D array `x` and scalars `lo < hi`, return a **new** array equal to
`x` but with every element strictly between `lo` and `hi` negated (multiplied
by -1). Leave `x` unchanged. Use a boolean mask — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_indexing/mask_negate
```
Edit `submission.py` until every test passes.
