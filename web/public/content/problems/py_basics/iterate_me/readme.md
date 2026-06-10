# Iterate Me

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** easy

A warm-up of nine small list functions — solve each **without** a `for`/`while`
loop (use comprehensions, slicing, and builtins):

- `get_squares(elements)` — the squares.
- `get_indices_from_one(elements)` — `[1, 2, ..., len]`.
- `get_max_element_index(elements)` — index of the max (None if empty).
- `get_every_second_element(elements)` — every second element from index 1.
- `get_first_three_index(elements)` / `get_last_three_index(elements)` — index of
  the first / last `3` (None if absent).
- `get_sum(elements)` — the sum.
- `get_min_max(elements, default)` — `(min, max)`, or `(default, default)` if empty.
- `get_by_index(elements, i, boundary)` — `elements[i]` if it exceeds `boundary`,
  else None.

## Constraints

- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/py_basics/iterate_me
```
Edit `submission.py` until every test passes.
