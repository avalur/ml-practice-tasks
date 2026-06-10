META = {
    "title": "Nearest Value in a Matrix",
    "topic": "numpy_indexing",
    "difficulty": "easy",
    "entry": "nearest_value",
    "banned": {
        "loops": True,
    },
    "hints": [
        "Flatten the matrix, then np.abs(flat - value).argmin() gives the index of the closest element.",
    ],
    "statement": """
Implement `nearest_value(matrix, value)`.

Return the element of `matrix` (any shape) closest to `value` — the one
minimizing `|element - value|` — as a float. If the matrix is empty, return
`None`. No `for`/`while` loops.
""",
}
