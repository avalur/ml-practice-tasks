# Checkerboard

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `checkerboard(n)`.

Return an `(n, n)` integer array filled with a 0/1 checkerboard pattern where
the top-left cell `[0, 0]` is `0` (so cell `[i, j]` is `(i + j) % 2`). Use
slicing — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/checkerboard
```
Edit `submission.py` until every test passes.
