# Split into Equal Parts

**Topic:** `numpy_combine` &nbsp;|&nbsp; **Difficulty:** easy

Implement `split_equal(x, n)`.

Given a 1D array `x` whose length is divisible by `n`, split it into `n`
equal-length contiguous parts and return them as a list of `n` arrays. For
example `split_equal([1, 2, 3, 4, 5, 6], 3)` → `[[1, 2], [3, 4], [5, 6]]`.
No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_combine/split_equal
```
Edit `submission.py` until every test passes.
