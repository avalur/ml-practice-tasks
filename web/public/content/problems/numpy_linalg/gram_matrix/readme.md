# Gram Matrix

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** easy

Implement `gram_matrix(X)`.

Given a 2D array `X` of shape `(m, n)` (m rows / samples), return the
`(m, m)` Gram matrix `G` where `G[i, j]` is the dot product of row `i` and
row `j`. No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/gram_matrix
```
Edit `submission.py` until every test passes.
