# Sum Over the Last Two Axes

**Topic:** `numpy_reductions` &nbsp;|&nbsp; **Difficulty:** medium

Implement `sum_last_two(A)`.

Given an array `A` with at least 2 dimensions, return the array obtained by
summing over its **last two** axes (result shape `A.shape[:-2]`). No
`for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_reductions/sum_last_two
```
Edit `submission.py` until every test passes.
