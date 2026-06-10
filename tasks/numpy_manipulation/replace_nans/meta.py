META = {
    "title": "Replace NaNs With the Mean",
    "topic": "numpy_manipulation",
    "difficulty": "easy",
    "entry": "replace_nans",
    "banned": {
        "loops": True,
    },
    "hints": [
        "Build a boolean mask with np.isnan; if it's all True, fill zeros, else assign matrix[~mask].mean() at the masked positions.",
    ],
    "statement": """
Implement `replace_nans(matrix)`.

Return a copy of `matrix` with every `NaN` replaced by the mean of all non-`NaN`
values. If every value is `NaN` (or the matrix is empty), return zeros of the
same shape. Leave the input unchanged. No `for`/`while` loops.
""",
}
