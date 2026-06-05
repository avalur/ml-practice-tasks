# Zero Border Around a Matrix

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `pad_border(X)`.

Given a 2D array `X` of shape `(m, n)`, return a `(m + 2, n + 2)` array that
is `X` surrounded by a one-cell border of zeros. Build it yourself with
slicing — `np.pad` is **not allowed** — and no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Forbidden functions: pad
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/pad_border
```
Edit `submission.py` until every test passes.
