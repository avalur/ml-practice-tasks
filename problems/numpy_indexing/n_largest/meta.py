META = {
    "title": "N Largest Values",
    "topic": "numpy_indexing",
    "difficulty": "medium",
    "entry": "n_largest",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.argpartition puts the n largest in front (unordered); take them, then sort descending.",
    ],
    "statement": """
Implement `n_largest(x, n)`.

Given a 1D array `x` and an integer `n` (with `1 <= n <= len(x)`), return the
`n` largest values of `x`, **sorted in descending order**. No `for`/`while`
loops. (Hint: `np.argpartition` finds the top `n` without a full sort.)
""",
}
