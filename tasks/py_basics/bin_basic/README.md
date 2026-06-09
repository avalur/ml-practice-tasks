# Binary Search

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `find_value(nums, value)`.

`nums` is a list (or `range`) of integers sorted in non-decreasing order; it may
be empty. Return `True` if `value` is present, otherwise `False`. Use **binary
search** — O(log n) time, O(1) extra space.

The `in` operator and the `bisect` module are not allowed: write the search
yourself. (One test runs on a huge range where a linear scan would time out.)

## Constraints

- Forbidden modules: bisect
- Forbidden operators: in, not in

## How to run

```bash
pytest tasks/py_basics/bin_basic
```
Edit `submission.py` until every test passes.
