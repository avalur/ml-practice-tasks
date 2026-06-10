# Iterator Warm-up

**Topic:** `py_functional` &nbsp;|&nbsp; **Difficulty:** easy

Four small iterator/collection utilities:

- `transpose(matrix)` — transpose a rectangular matrix (rows ↔ columns).
- `uniq(sequence)` — a **generator** yielding elements in order, dropping later
  duplicates (keep the first occurrence).
- `dict_merge(*dicts)` — merge flat dicts; on a key collision the later dict wins.
- `product(lhs, rhs)` — the scalar (dot) product of two equal-length int lists.

## How to run

```bash
pytest tasks/py_functional/warm_up
```
Edit `submission.py` until every test passes.
