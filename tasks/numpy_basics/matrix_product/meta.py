META = {
    "title": "Matrix Product",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "matrix_product",
    "order": 9,
    "banned": {
        "loops": True,
    },
    "hints": [
        "The @ operator (or np.dot) computes the real matrix product.",
    ],
    "statement": """
Implement `matrix_product(a, b)`.

Given a matrix `a` of shape `(m, k)` and a matrix `b` of shape `(k, n)`,
return their matrix product `a @ b` (shape `(m, n)`). For example, a 5×3
matrix times a 3×2 matrix gives a 5×2 matrix. No `for`/`while` loops.
""",
}
