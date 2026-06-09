META = {
    "title": "Transpose a Matrix",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "transpose_2d",
    "order": 13,
    "banned": {
        "loops": True,
    },
    "hints": [
        "X.T (or np.transpose(X)) swaps the two axes of a 2D array.",
    ],
    "statement": """
Implement `transpose_2d(X)`.

Given a 2D array `X` of shape `(m, n)`, return its transpose of shape
`(n, m)`: the element at position `(j, i)` of the result equals `X[i, j]`.
No `for`/`while` loops.
""",
}
