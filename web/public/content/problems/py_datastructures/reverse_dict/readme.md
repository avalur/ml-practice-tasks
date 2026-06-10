# Invert a Dictionary

**Topic:** `py_datastructures` &nbsp;|&nbsp; **Difficulty:** easy

Implement `revert(dct)`.

Invert a `{key: value}` mapping into `{value: [keys...]}`: each value becomes a
key whose list holds every original key that mapped to it. Don't modify the
input. For example `revert({"a": "1", "b": "2", "c": "1"})` →
`{"1": ["a", "c"], "2": ["b"]}` (key order within a list doesn't matter). Do it
in O(n) — a single pass, not O(n^2).

## How to run

```bash
pytest tasks/py_datastructures/reverse_dict
```
Edit `submission.py` until every test passes.
