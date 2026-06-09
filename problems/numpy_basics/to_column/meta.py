META = {
    "title": "Column Vector",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "to_column",
    "order": 14,
    "banned": {
        "loops": True,
    },
    "hints": [
        "Transposing a 1D array does nothing; add an axis instead: x.reshape(-1, 1) or x[:, None].",
    ],
    "statement": """
Implement `to_column(x)`.

Given a 1D array `x` of length `n`, return it as a 2D **column vector** of
shape `(n, 1)`. Remember that `x.T` leaves a 1D array unchanged — you need to
add a new axis (e.g. `reshape(-1, 1)` or `x[:, None]`). No `for`/`while` loops.
""",
}
