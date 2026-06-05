# Normalize an Array

**Topic:** `numpy_broadcasting` &nbsp;|&nbsp; **Difficulty:** easy

Implement `normalize(x)`.

Return `x` z-normalized over **all** its elements: subtract the overall mean
and divide by the overall standard deviation, i.e. `(x - mean) / std`.
Vectorize it — no `for`/`while` loops. Assume `std > 0`.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_broadcasting/normalize
```
Edit `submission.py` until every test passes.
