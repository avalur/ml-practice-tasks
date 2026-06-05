# Cauchy Matrix

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** medium

Implement `cauchy(x, y)`.

Given 1D arrays `x` (length n) and `y` (length m) with all `x[i] != y[j]`,
return the `(n, m)` Cauchy matrix `C` where `C[i, j] = 1 / (x[i] - y[j])`.
Use broadcasting — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/cauchy
```
Edit `submission.py` until every test passes.
