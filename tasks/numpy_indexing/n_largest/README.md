# N Largest Values

**Topic:** `numpy_indexing` &nbsp;|&nbsp; **Difficulty:** medium

Implement `n_largest(x, n)`.

Given a 1D array `x` and an integer `n` (with `1 <= n <= len(x)`), return the
`n` largest values of `x`, **sorted in descending order**. No `for`/`while`
loops. (Hint: `np.argpartition` finds the top `n` without a full sort.)

## Constraints

- Forbidden modules: scipy, sklearn
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_indexing/n_largest
```
Edit `submission.py` until every test passes.
