META = {
    "title": "Common Values",
    "topic": "numpy_indexing",
    "difficulty": "medium",
    "entry": "intersect",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.intersect1d(a, b) returns the sorted, unique values common to both.",
    ],
    "statement": """
Implement `intersect(a, b)`.

Given two 1D arrays `a` and `b`, return the sorted array of unique values
that appear in **both**. No `for`/`while` loops.
""",
}
