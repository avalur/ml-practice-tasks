# Reshape to a Matrix

**Topic:** `numpy_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `to_matrix(x, rows)`.

Given a 1D array `x` whose length is divisible by `rows`, reshape it into a
2D array with `rows` rows (row-major / C order). Let NumPy infer the number
of columns by passing `-1` for that dimension. No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_basics/to_matrix
```
Edit `submission.py` until every test passes.
