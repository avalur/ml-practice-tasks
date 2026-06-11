META = {
    "title": "Iterate Me",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "get_squares",
    "order": 8,
    "py_deps": [],
    "banned": {
        "loops": True,
    },
    "prereqs": ["py_basics/fizz_buzz"],
    "next": ["py_functional/flat_it"],
    "hints": [
        "No explicit loops — reach for comprehensions, slicing, and builtins (range, len, sum, min, max, list.index).",
        "get_last_three_index: search the reversed list and convert the index; get_by_index reads nicely with a walrus (:=).",
    ],
    "statement": """
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
""",
}
