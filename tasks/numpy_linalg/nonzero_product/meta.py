META = {
    "title": "Product of Nonzero Diagonal",
    "topic": "numpy_linalg",
    "difficulty": "easy",
    "entry": "nonzero_product",
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.diag(matrix) extracts the main diagonal; keep the entries that are != 0 with a boolean mask, then np.prod them.",
    ],
    "statement": """
Implement `nonzero_product(matrix)`.

Return the product of the **nonzero** elements on the main diagonal of a 2D
array. If every diagonal element is zero (or there is no diagonal), return
`None`. For example the diagonal of `[[1,0,1],[2,0,2],[3,0,3],[4,4,4]]` is
`[1, 0, 3]`, so the answer is `1 * 3 = 3`. No `for`/`while` loops.
""",
}
