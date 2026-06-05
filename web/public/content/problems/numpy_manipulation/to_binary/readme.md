# Integers to Binary Matrix

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

Implement `to_binary(x, bits)`.

Given a 1D array `x` of non-negative integers, return a `(len(x), bits)` array
of 0/1 where row `i` is the binary representation of `x[i]`, **most
significant bit first**. No `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/to_binary
```
Edit `submission.py` until every test passes.
