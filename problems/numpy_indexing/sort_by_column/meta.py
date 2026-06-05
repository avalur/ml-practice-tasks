META = {
    "title": "Sort Rows by a Column",
    "topic": "numpy_indexing",
    "difficulty": "medium",
    "entry": "sort_by_column",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "argsort the chosen column to get a row order, then index the rows with it.",
    ],
    "statement": """
Implement `sort_by_column(X, k)`.

Given a 2D array `X` and a column index `k`, return `X` with its **rows**
reordered so that column `k` is ascending. Use `argsort` + fancy indexing —
no `for`/`while` loops.
""",
}
