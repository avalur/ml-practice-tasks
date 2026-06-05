META = {
    "title": "Moving Average",
    "topic": "numpy_reductions",
    "difficulty": "medium",
    "entry": "moving_average",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.cumsum gives prefix sums; a window sum is the difference of two of them.",
    ],
    "statement": """
Implement `moving_average(a, n)`.

Given a 1D array `a` and a window length `n`, return the array of
length-`n` moving averages. The output has length `len(a) - n + 1`, where
output `i` is the mean of `a[i : i + n]`. Vectorize it — no `for`/`while`
loops (hint: prefix sums).
""",
}
