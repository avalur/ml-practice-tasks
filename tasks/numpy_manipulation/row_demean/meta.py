META = {
    "title": "Subtract Each Row's Mean",
    "topic": "numpy_manipulation",
    "difficulty": "medium",
    "entry": "row_demean",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Reduce along axis=1 with keepdims=True so the per-row means broadcast back.",
    ],
    "statement": """
Implement `row_demean(X)`.

Given a 2D array `X` of shape `(m, n)`, return an array of the same shape
where the mean of each **row** has been subtracted from that row. Vectorize
it with broadcasting — no `for`/`while` loops.
""",
}
