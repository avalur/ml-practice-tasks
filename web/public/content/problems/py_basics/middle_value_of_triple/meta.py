META = {
    "title": "Middle of Three",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "get_middle_value",
    "order": 3,
    "py_deps": [],
    "banned": {
        "names": ["sorted"],
    },
    "hints": [
        "The three values minus the smallest and the largest leaves the middle one.",
    ],
    "statement": """
Implement `get_middle_value(a, b, c)`.

Return the middle (median) of three integers — the one that is neither the
smallest nor the largest. `sorted` is **not** allowed; use arithmetic with
`min`/`max` instead. For example `get_middle_value(3, 1, 2) == 2`.
""",
}
