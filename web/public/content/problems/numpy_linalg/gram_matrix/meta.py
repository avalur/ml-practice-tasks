META = {
    "title": "Gram Matrix",
    "topic": "numpy_linalg",
    "difficulty": "easy",
    "entry": "gram_matrix",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "The Gram matrix of rows is X @ X.T.",
    ],
    "statement": """
Implement `gram_matrix(X)`.

Given a 2D array `X` of shape `(m, n)` (m rows / samples), return the
`(m, m)` Gram matrix `G` where `G[i, j]` is the dot product of row `i` and
row `j`. No `for`/`while` loops.
""",
}
