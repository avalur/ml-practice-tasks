# Moving Average

**Topic:** `numpy_reductions` &nbsp;|&nbsp; **Difficulty:** medium

Implement `moving_average(a, n)`.

Given a 1D array `a` and a window length `n`, return the array of
length-`n` moving averages. The output has length `len(a) - n + 1`, where
output `i` is the mean of `a[i : i + n]`. Vectorize it — no `for`/`while`
loops (hint: prefix sums).

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_reductions/moving_average
```
Edit `submission.py` until every test passes.
