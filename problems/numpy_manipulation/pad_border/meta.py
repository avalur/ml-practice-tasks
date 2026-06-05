META = {
    "title": "Zero Border Around a Matrix",
    "topic": "numpy_manipulation",
    "difficulty": "easy",
    "entry": "pad_border",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "names": ["pad"],
        "loops": True,
    },
    "hints": [
        "Allocate a zeros array two larger in each dimension, then drop X into the middle with slicing.",
    ],
    "statement": """
Implement `pad_border(X)`.

Given a 2D array `X` of shape `(m, n)`, return a `(m + 2, n + 2)` array that
is `X` surrounded by a one-cell border of zeros. Build it yourself with
slicing — `np.pad` is **not allowed** — and no `for`/`while` loops.
""",
}
