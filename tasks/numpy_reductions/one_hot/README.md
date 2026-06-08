# One-Hot Encoding

**Topic:** `numpy_reductions` &nbsp;|&nbsp; **Difficulty:** easy

Implement `one_hot(labels, k)`.

Given a 1D integer array `labels` with values in `[0, k)`, return a
`(len(labels), k)` array of 0/1 where row `i` has a `1.0` in column
`labels[i]` and `0.0` elsewhere. Vectorize it — no `for`/`while` loops.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_reductions/one_hot
```
Edit `submission.py` until every test passes.
