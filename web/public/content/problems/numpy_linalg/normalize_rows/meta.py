META = {
    "title": "Normalize Rows to Unit Length",
    "topic": "numpy_linalg",
    "difficulty": "medium",
    "entry": "normalize_rows",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.linalg.norm(X, axis=1, keepdims=True) gives per-row L2 norms to divide by.",
    ],
    "statement": """
Implement `normalize_rows(X)`.

Given a 2D array `X` of shape `(m, n)`, return an array of the same shape
where each **row** is scaled to unit L2 norm (`row / ||row||`). Assume no
row is all zeros. Vectorize with broadcasting — no `for`/`while` loops.
""",
}
