META = {
    "title": "Split into Equal Parts",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "split_equal",
    "order": 4,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.split(x, n) divides x into n equal-length sub-arrays (it returns a list).",
    ],
    "statement": """
Implement `split_equal(x, n)`.

Given a 1D array `x` whose length is divisible by `n`, split it into `n`
equal-length contiguous parts and return them as a list of `n` arrays. For
example `split_equal([1, 2, 3, 4, 5, 6], 3)` → `[[1, 2], [3, 4], [5, 6]]`.
No `for`/`while` loops.
""",
}
