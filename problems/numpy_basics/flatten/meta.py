META = {
    "title": "Flatten an Array",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "flatten",
    "order": 12,
    "banned": {
        "loops": True,
    },
    "hints": [
        "x.ravel() (or x.flatten(), or x.reshape(-1)) returns all elements in row-major order.",
    ],
    "statement": """
Implement `flatten(X)`.

Given an array `X` of any shape, return a 1D array containing all of its
elements in row-major (C) order — the first row, then the second, and so on.
No `for`/`while` loops.
""",
}
