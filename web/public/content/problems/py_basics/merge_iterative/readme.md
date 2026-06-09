# Merge Two Sorted Lists

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `merge_iterative(lst_a, lst_b)`.

Both inputs are sorted in non-decreasing order. Return one merged sorted list —
the classic merge step of merge sort, done **by hand**. Leave the inputs
unchanged. For example `merge_iterative([1, 3], [2, 4]) == [1, 2, 3, 4]`.

`sorted` and slicing (`seq[a:b]`) are not allowed — use two pointers,
O(len(a) + len(b)).

## Constraints

- Forbidden functions: sorted
- Slicing `seq[a:b]` is not allowed (plain indexing `seq[i]` is fine)

## How to run

```bash
pytest tasks/py_basics/merge_iterative
```
Edit `submission.py` until every test passes.
