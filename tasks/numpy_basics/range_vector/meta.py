META = {
    "title": "Range Vector",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "range_vector",
    "order": 5,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.arange(lo, hi) yields lo, lo+1, ..., hi-1.",
    ],
    "statement": """
Implement `range_vector(lo, hi)`.

Return a 1D array of the consecutive integers from `lo` up to but not
including `hi` (`lo, lo+1, ..., hi-1`). For example, `range_vector(10, 50)`
ranges from 10 to 49. No `for`/`while` loops.
""",
}
