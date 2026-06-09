META = {
    "title": "Reshape to a Matrix",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "to_matrix",
    "order": 11,
    "banned": {
        "loops": True,
    },
    "hints": [
        "Pass -1 for the unknown dimension: x.reshape(rows, -1) lets NumPy compute the columns.",
    ],
    "statement": """
Implement `to_matrix(x, rows)`.

Given a 1D array `x` whose length is divisible by `rows`, reshape it into a
2D array with `rows` rows (row-major / C order). Let NumPy infer the number
of columns by passing `-1` for that dimension. No `for`/`while` loops.
""",
}
