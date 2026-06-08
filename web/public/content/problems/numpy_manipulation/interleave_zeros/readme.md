# Interleave Zeros

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `interleave_zeros(z, nz)`.

Given a 1D array `z` and a count `nz`, return a new 1D array with `nz` zeros
inserted between each pair of consecutive elements of `z`. The result has
length `len(z) + (len(z) - 1) * nz`. Example: `z = [1, 2, 3]`, `nz = 2`
→ `[1, 0, 0, 2, 0, 0, 3]`. No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/interleave_zeros
```
Edit `submission.py` until every test passes.
