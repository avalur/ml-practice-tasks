META = {
    "title": "Closest Value",
    "topic": "numpy_indexing",
    "difficulty": "easy",
    "entry": "closest_value",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "a.argmin() gives the index of the min element.",
    ],
    "statement": """
Implement `closest_value(x, v)`.

Given a 1D array `x` and a scalar `v`, return the element of `x` closest to
`v` (the one minimizing `|x - v|`). No `for`/`while` loops.
""",
}
