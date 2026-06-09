META = {
    "title": "Stack Arrays as Columns",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "stack_columns",
    "order": 3,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.column_stack(arrays) places each 1D array as a column of the result.",
    ],
    "statement": """
Implement `stack_columns(arrays)`.

Given a list of `k` equal-length 1D arrays, return a 2D array of shape
`(n, k)` whose column `j` is `arrays[j]` — i.e. assemble the arrays as the
columns of a matrix (a design / feature matrix). No `for`/`while` loops.
""",
}
