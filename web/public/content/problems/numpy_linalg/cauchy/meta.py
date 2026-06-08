META = {
    "title": "Cauchy Matrix",
    "topic": "numpy_linalg",
    "difficulty": "easy",
    "entry": "cauchy",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.subtract.outer(x, y) builds the (len(x), len(y)) difference matrix; take its reciprocal.",
    ],
    "statement": """
Implement `cauchy(x, y)`.

Given 1D arrays `x` (length n) and `y` (length m) with all `x[i] != y[j]`,
return the `(n, m)` Cauchy matrix `C` where `C[i, j] = 1 / (x[i] - y[j])`.
Use broadcasting — no `for`/`while` loops.
""",
}
