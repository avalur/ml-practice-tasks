META = {
    "title": "Indices of Non-Zero Elements",
    "topic": "numpy_indexing",
    "difficulty": "easy",
    "entry": "nonzero_indices",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.nonzero(x) returns the indices of the non-zero entries (take [0] for 1D).",
    ],
    "statement": """
Implement `nonzero_indices(x)`.

Given a 1D array `x`, return a 1D array of the indices where `x` is non-zero,
in increasing order. No `for`/`while` loops.
""",
}
