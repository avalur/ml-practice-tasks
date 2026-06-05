META = {
    "title": "Negate Values in a Range",
    "topic": "numpy_indexing",
    "difficulty": "medium",
    "entry": "mask_negate",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Build a boolean mask (x > lo) & (x < hi) and flip the sign of those entries in a copy.",
    ],
    "statement": """
Implement `mask_negate(x, lo, hi)`.

Given a 1D array `x` and scalars `lo < hi`, return a **new** array equal to
`x` but with every element strictly between `lo` and `hi` negated (multiplied
by -1). Leave `x` unchanged. Use a boolean mask — no `for`/`while` loops.
""",
}
