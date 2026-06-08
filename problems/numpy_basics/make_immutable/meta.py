META = {
    "title": "Read-Only Array",
    "topic": "numpy_basics",
    "difficulty": "medium",
    "entry": "make_immutable",
    "order": 10,
    "banned": {},
    "hints": [
        "Every array has a.flags.writeable — set it to False to freeze the array.",
    ],
    "statement": """
Implement `make_immutable(a)`.

Return the array `a` made **read-only**: its values stay the same, but any
attempt to assign into the result (e.g. `result[0] = 1`) must raise. (NumPy
arrays expose a `flags.writeable` flag for exactly this.)
""",
}
