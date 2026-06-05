META = {
    "title": "One-Hot Encoding",
    "topic": "numpy_reductions",
    "difficulty": "medium",
    "entry": "one_hot",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Index the rows with np.arange and the columns with the labels in a single assignment.",
    ],
    "statement": """
Implement `one_hot(labels, k)`.

Given a 1D integer array `labels` with values in `[0, k)`, return a
`(len(labels), k)` array of 0/1 where row `i` has a `1.0` in column
`labels[i]` and `0.0` elsewhere. Vectorize it — no `for`/`while` loops.
""",
}
