META = {
    "title": "Replace the Max with Zero",
    "topic": "numpy_warmup",
    "hidden": True,
    "difficulty": "easy",
    "entry": "replace_max",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "argmax gives the index of the maximum; copy first so the input isn't mutated.",
    ],
    "statement": """
Implement `replace_max(x)`.

Given a 1D array `x`, return a **new** array equal to `x` but with its
maximum element replaced by `0` (leave `x` itself unchanged). If the max
occurs more than once, replace the first occurrence. No `for`/`while` loops.
""",
}
