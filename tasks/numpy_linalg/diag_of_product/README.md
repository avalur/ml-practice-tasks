# Diagonal of a Matrix Product

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** medium

Implement `diag_of_product(A, B)`.

Given `A` of shape `(n, k)` and `B` of shape `(k, n)`, return the diagonal of
the product `A @ B` as a 1D array of length `n` — i.e. element `i` is
`A[i] . B[:, i]`. Do it **without** forming the full `A @ B`, and with no
`for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/diag_of_product
```
Edit `submission.py` until every test passes.
