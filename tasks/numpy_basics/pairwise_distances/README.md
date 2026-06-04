# Pairwise Euclidean Distances

**Topic:** `numpy_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `pairwise_distances(x, y)`.

Given `x` of shape `(n, d)` and `y` of shape `(m, d)`, return an array `D`
of shape `(n, m)` where `D[i, j]` is the Euclidean distance between `x[i]`
and `y[j]`.

The whole point of this task is to practice broadcasting, so you must
vectorize it.

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_basics/pairwise_distances
```
Edit `submission.py` until every test passes.
