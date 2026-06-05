META = {
    "title": "Swap Two Rows",
    "topic": "numpy_manipulation",
    "difficulty": "easy",
    "entry": "swap_rows",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Fancy-index the two rows and assign them back in swapped order: out[[i, j]] = out[[j, i]].",
    ],
    "statement": """
Implement `swap_rows(X, i, j)`.

Given a 2D array `X` and two row indices `i`, `j`, return a **new** array
equal to `X` with rows `i` and `j` swapped (leave `X` unchanged). No
`for`/`while` loops.
""",
}
