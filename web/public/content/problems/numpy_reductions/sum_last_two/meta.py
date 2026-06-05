META = {
    "title": "Sum Over the Last Two Axes",
    "topic": "numpy_reductions",
    "difficulty": "medium",
    "entry": "sum_last_two",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Pass a tuple of axes to sum: A.sum(axis=(-2, -1)).",
    ],
    "statement": """
Implement `sum_last_two(A)`.

Given an array `A` with at least 2 dimensions, return the array obtained by
summing over its **last two** axes (result shape `A.shape[:-2]`). No
`for`/`while` loops.
""",
}
