META = {
    "title": "Diagonal of a Matrix Product",
    "topic": "numpy_linalg",
    "difficulty": "medium",
    "entry": "diag_of_product",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Entry i of diag(A@B) is row i of A dotted with column i of B — np.einsum('ij,ji->i', A, B) does it without building the full product.",
    ],
    "statement": """
Implement `diag_of_product(A, B)`.

Given `A` of shape `(n, k)` and `B` of shape `(k, n)`, return the diagonal of
the product `A @ B` as a 1D array of length `n` — i.e. element `i` is
`A[i] . B[:, i]`. Do it **without** forming the full `A @ B`, and with no
`for`/`while` loops.
""",
}
