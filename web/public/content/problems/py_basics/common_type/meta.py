META = {
    "title": "Common Type",
    "topic": "py_basics",
    "difficulty": "medium",
    "entry": "get_common_type",
    "order": 7,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Two ladders of increasing generality: numbers bool→int→float→complex, sequences range→tuple→list. Within a ladder, pick the more general.",
        "A number mixed with a sequence (or anything mixed with str) has no shared container — fall back to str. Two ranges share tuple, since you can't build a range from arbitrary elements.",
    ],
    "statement": """
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
""",
}
