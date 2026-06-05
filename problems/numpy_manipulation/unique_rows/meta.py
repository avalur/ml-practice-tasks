META = {
    "title": "Unique Rows",
    "topic": "numpy_manipulation",
    "difficulty": "medium",
    "entry": "unique_rows",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.unique(X, axis=0) returns the distinct rows (sorted).",
    ],
    "statement": """
Implement `unique_rows(X)`.

Given a 2D array `X`, return its distinct rows as a 2D array, sorted in
ascending (lexicographic) order — i.e. the result of treating each row as a
unit. No `for`/`while` loops.
""",
}
