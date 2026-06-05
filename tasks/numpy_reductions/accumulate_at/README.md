# Scatter-Add by Index

**Topic:** `numpy_reductions` &nbsp;|&nbsp; **Difficulty:** medium

Implement `accumulate_at(values, idx, n)`.

Given 1D arrays `values` and `idx` (same length, `idx` values in `[0, n)`),
return an array `out` of length `n` where `out[k]` is the sum of all
`values[j]` for which `idx[j] == k`. No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_reductions/accumulate_at
```
Edit `submission.py` until every test passes.
