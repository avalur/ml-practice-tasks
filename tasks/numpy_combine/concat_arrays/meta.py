META = {
    "title": "Concatenate Arrays",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "concat_arrays",
    "order": 1,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.concatenate(arrays) joins a sequence of arrays along an existing axis.",
    ],
    "statement": """
Implement `concat_arrays(arrays)`.

Given a list of 1D arrays, return a single 1D array that is their end-to-end
concatenation, preserving order. For example `[[1, 2], [3], [4, 5]]` →
`[1, 2, 3, 4, 5]`. No `for`/`while` loops.
""",
}
