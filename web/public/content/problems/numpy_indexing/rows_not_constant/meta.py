META = {
    "title": "Rows That Are Not Constant",
    "topic": "numpy_indexing",
    "difficulty": "medium",
    "entry": "rows_not_constant",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "A row is constant iff its max equals its min — compare per-row max and min, then mask rows.",
    ],
    "statement": """
Implement `rows_not_constant(X)`.

Given a 2D array `X`, return the sub-array of rows that are **not** constant
(rows whose values are not all equal), preserving their order. Use a boolean
row mask — no `for`/`while` loops.
""",
}
