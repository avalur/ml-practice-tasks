# Memory Size of an Array

**Topic:** `numpy_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `memory_size(a)`.

Return the total number of bytes the array `a` occupies in memory — the
number of elements times the number of bytes per element. Compute it from
`a.size` and `a.itemsize` (the `nbytes` shortcut is not allowed).

## Constraints

- Forbidden modules: scipy, sklearn
- Forbidden functions: nbytes

## How to run

```bash
pytest tasks/numpy_basics/memory_size
```
Edit `submission.py` until every test passes.
