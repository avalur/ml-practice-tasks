META = {
    "title": "Stack Arrays as Rows",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "stack_rows",
    "order": 2,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.vstack(arrays) (or np.stack(arrays, axis=0)) stacks 1D arrays into the rows of a 2D array.",
    ],
    "statement": """
Implement `stack_rows(arrays)`.

Given a list of `k` equal-length 1D arrays, return a 2D array of shape
`(k, n)` whose row `i` is `arrays[i]`. No `for`/`while` loops.
""",
}
