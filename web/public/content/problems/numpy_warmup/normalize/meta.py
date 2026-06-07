META = {
    "title": "Normalize an Array",
    "topic": "numpy_warmup",
    "hidden": True,
    "difficulty": "easy",
    "entry": "normalize",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Compute the mean and std over the whole array, then broadcast them back.",
    ],
    "statement": """
Implement `normalize(x)`.

Return `x` z-normalized over **all** its elements: subtract the overall mean
and divide by the overall standard deviation, i.e. `(x - mean) / std`.
Vectorize it — no `for`/`while` loops. Assume `std > 0`.
""",
}
