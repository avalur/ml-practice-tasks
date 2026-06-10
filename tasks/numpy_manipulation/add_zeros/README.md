# Interleave Zeros Between Elements

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `add_zeros(x)`.

Given a 1D integer array `x`, return a new array with a single zero inserted
between each pair of adjacent elements: `[1, 2, 3]` → `[1, 0, 2, 0, 3]`. An
array with fewer than two elements is returned unchanged. No `for`/`while`
loops — use a strided assignment.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/add_zeros
```
Edit `submission.py` until every test passes.
