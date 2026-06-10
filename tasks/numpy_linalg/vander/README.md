# Vandermonde Matrix

**Topic:** `numpy_linalg` &nbsp;|&nbsp; **Difficulty:** easy

Implement `vander(array)`.

Build the Vandermonde matrix with **increasing** powers: the element at row `i`,
column `j` is `array[i] ** j`. A length-`n` vector gives an `n × n` matrix, e.g.
`[1, 2, 3]` → `[[1, 1, 1], [1, 2, 4], [1, 3, 9]]`.

`np.vander` is not allowed — construct it with broadcasting. No `for`/`while`
loops.

## Constraints

- Forbidden functions: vander
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/numpy_linalg/vander
```
Edit `submission.py` until every test passes.
