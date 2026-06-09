META = {
    "title": "Repeat Each Element",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "repeat_each",
    "order": 6,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.repeat(x, k) repeats each element k times; contrast with np.tile, which repeats the whole array.",
    ],
    "statement": """
Implement `repeat_each(x, k)`.

Given a 1D array `x` and an integer `k`, return a 1D array in which each
element of `x` is repeated `k` times consecutively. For example
`repeat_each([1, 2, 3], 2)` → `[1, 1, 2, 2, 3, 3]` (not `[1, 2, 3, 1, 2, 3]`).
No `for`/`while` loops.
""",
}
