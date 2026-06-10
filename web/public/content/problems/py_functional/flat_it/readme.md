# Flatten It (generator)

**Topic:** `py_functional` &nbsp;|&nbsp; **Difficulty:** medium

Implement `flat_it(sequence)` as a **generator** that lazily flattens an
iterable with an arbitrary level of nesting into a flat stream of leaves, in
order. For example `list(flat_it((1, (2, 3), [4, [5, 6], 7]))) == [1, 2, 3, 4,
5, 6, 7]`.

Strings are iterable, so a multi-character string flattens into its characters
(`"ab"` → `"a", "b"`); stop recursing at a single character so iterating a
1-char string terminates. Non-iterables are yielded as-is. Use `yield` (the
result must be a generator).

## How to run

```bash
pytest tasks/py_functional/flat_it
```
Edit `submission.py` until every test passes.
