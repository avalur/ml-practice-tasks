# Block Sum

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

Implement `block_sum(X, b)`.

Given a 2D array `X` of shape `(n, n)` where `n` is divisible by `b`, return
a `(n//b, n//b)` array whose entry `(r, c)` is the sum of the non-overlapping
`b x b` block at block-row `r`, block-column `c`. Use reshaping — no
`for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/block_sum
```
Edit `submission.py` until every test passes.
