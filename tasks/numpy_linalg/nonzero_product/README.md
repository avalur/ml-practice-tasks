# Product of Nonzero Diagonal

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** easy

Implement `nonzero_product(matrix)`.

Return the product of the **nonzero** elements on the main diagonal of a 2D
array. If every diagonal element is zero (or there is no diagonal), return
`None`. For example the diagonal of `[[1,0,1],[2,0,2],[3,0,3],[4,4,4]]` is
`[1, 0, 3]`, so the answer is `1 * 3 = 3`. No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/nonzero_product
```
Edit `submission.py` until every test passes.
