META = {
    "title": "Trace by Hand",
    "topic": "numpy_linalg",
    "difficulty": "easy",
    "entry": "trace",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "names": ["trace"],
        "loops": True,
    },
    "hints": [
        "np.diag pulls out the diagonal; sum it. (np.einsum('ii->', X) also works.)",
    ],
    "statement": """
Implement `trace(X)`.

Return the trace of a square matrix `X` (the sum of its diagonal entries).
Compute it yourself — `np.trace` is **not allowed** — and no `for`/`while`
loops.
""",
}
