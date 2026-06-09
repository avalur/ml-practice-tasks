# Column Vector

**Topic:** `numpy_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `to_column(x)`.

Given a 1D array `x` of length `n`, return it as a 2D **column vector** of
shape `(n, 1)`. Remember that `x.T` leaves a 1D array unchanged — you need to
add a new axis (e.g. `reshape(-1, 1)` or `x[:, None]`). No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_basics/to_column
```
Edit `submission.py` until every test passes.
