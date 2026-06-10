# Replace NaNs With the Mean

**Topic:** `numpy_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `replace_nans(matrix)`.

Return a copy of `matrix` with every `NaN` replaced by the mean of all non-`NaN`
values. If every value is `NaN` (or the matrix is empty), return zeros of the
same shape. Leave the input unchanged. No `for`/`while` loops.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_manipulation/replace_nans
```
Edit `submission.py` until every test passes.
