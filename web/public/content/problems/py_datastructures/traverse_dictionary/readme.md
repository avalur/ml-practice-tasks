# Flatten a Nested Dictionary

**Topic:** `py_datastructures` &nbsp;|&nbsp; **Difficulty:** medium

Implement three flatteners of an arbitrarily nested dict whose leaves are ints:
turn it into `(dotted_key, value)` pairs, e.g.
`{"a": {"b": 1}}` → `[("a.b", 1)]`. Key order in the result doesn't matter.

- `traverse_dictionary_immutable(dct, prefix="")` — recursion that **returns** a
  new list.
- `traverse_dictionary_mutable(dct, result, prefix="")` — recursion that
  **appends** to the given `result` list (returns `None`).
- `traverse_dictionary_iterative(dct)` — **no recursion**: use an explicit stack
  so it survives very deep nesting (100000 levels).

Don't modify the input dict.

## How to run

```bash
pytest tasks/py_datastructures/traverse_dictionary
```
Edit `submission.py` until every test passes.
