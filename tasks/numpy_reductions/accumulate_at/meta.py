META = {
    "title": "Scatter-Add by Index",
    "topic": "numpy_reductions",
    "difficulty": "medium",
    "entry": "accumulate_at",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.bincount(idx, weights=values, minlength=n) sums values into bins by index.",
    ],
    "statement": """
Implement `accumulate_at(values, idx, n)`.

Given 1D arrays `values` and `idx` (same length, `idx` values in `[0, n)`),
return an array `out` of length `n` where `out[k]` is the sum of all
`values[j]` for which `idx[j] == k`. No `for`/`while` loops.
""",
}
