# Stack Arrays as Columns

**Topic:** `numpy_combine` &nbsp;|&nbsp; **Difficulty:** easy

Implement `stack_columns(arrays)`.

Given a list of `k` equal-length 1D arrays, return a 2D array of shape
`(n, k)` whose column `j` is `arrays[j]` — i.e. assemble the arrays as the
columns of a matrix (a design / feature matrix). No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_combine/stack_columns
```
Edit `submission.py` until every test passes.
