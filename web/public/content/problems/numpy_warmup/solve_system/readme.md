# Solve a Linear System

**Topic:** `numpy_warmup` &nbsp;|&nbsp; **Difficulty:** medium

Implement `solve_system(A, b)`.

Given a square, invertible matrix `A` of shape `(n, n)` and a vector `b` of
length `n`, return the solution `x` of the linear system `A @ x = b`. No
`for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_warmup/solve_system
```
Edit `submission.py` until every test passes.
