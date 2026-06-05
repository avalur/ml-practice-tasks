# Replace the Max with Zero

**Topic:** `numpy_indexing` &nbsp;|&nbsp; **Difficulty:** easy

Implement `replace_max(x)`.

Given a 1D array `x`, return a **new** array equal to `x` but with its
maximum element replaced by `0` (leave `x` itself unchanged). If the max
occurs more than once, replace the first occurrence. No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_indexing/replace_max
```
Edit `submission.py` until every test passes.
