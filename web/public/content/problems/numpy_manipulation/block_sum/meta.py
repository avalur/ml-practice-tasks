META = {
    "title": "Block Sum",
    "topic": "numpy_manipulation",
    "difficulty": "medium",
    "entry": "block_sum",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Reshape (n, n) to (n//b, b, n//b, b) and sum axes 1 and 3.",
    ],
    "statement": """
Implement `block_sum(X, b)`.

Given a 2D array `X` of shape `(n, n)` where `n` is divisible by `b`, return
a `(n//b, n//b)` array whose entry `(r, c)` is the sum of the non-overlapping
`b x b` block at block-row `r`, block-column `c`. Use reshaping — no
`for`/`while` loops.
""",
}
