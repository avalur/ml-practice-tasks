# Common Type

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** medium

Implement `get_common_type(type1, type2)`.

Given two of the types `bool, int, float, complex, list, range, tuple, str`,
return the most specific type that **both** values can be converted to, so that
`result(value1)` and `result(value2)` both succeed and make sense.

Rules (two ladders of increasing generality):
- numbers: `bool` → `int` → `float` → `complex`
- sequences: `range` → `tuple` → `list`

Within one ladder, return the more general of the two. Mixing a number with a
sequence — or anything with `str` — returns `str`. Note `range` is never a
common type (you can't build a `range` from arbitrary elements), so two ranges
share `tuple`. The result must be the same regardless of argument order.

## How to run

```bash
pytest tasks/py_basics/common_type
```
Edit `submission.py` until every test passes.
