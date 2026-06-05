META = {
    "title": "Inverse of bincount",
    "topic": "numpy_manipulation",
    "difficulty": "medium",
    "entry": "repeat_counts",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.repeat(np.arange(len(counts)), counts) repeats each index by its count.",
    ],
    "statement": """
Implement `repeat_counts(counts)`.

Given a 1D non-negative integer array `counts`, return a 1D array in which
index `i` appears `counts[i]` times, in order. For example
`counts = [2, 0, 3]` → `[0, 0, 2, 2, 2]`. (This is the inverse of
`np.bincount`.) No `for`/`while` loops.
""",
}
