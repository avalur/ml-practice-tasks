# Filter Sorted List by List

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `filter_list_by_list(lst_a, lst_b)`.

Both inputs are sorted in non-decreasing order. Return a **new** list with the
elements of `lst_a` that do **not** appear in `lst_b`, preserving order and
duplicates; leave the inputs unchanged. For example
`filter_list_by_list([2, 3], [1, 2]) == [3]`.

`set` is not allowed — use the fact that both lists are sorted and walk them
with two pointers in O(len(a) + len(b)).

## Constraints

- Forbidden functions: set

## How to run

```bash
pytest tasks/py_basics/filter_list_by_list
```
Edit `submission.py` until every test passes.
