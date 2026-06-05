META = {
    "title": "Pairwise Euclidean Distances",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "pairwise_distances",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Think about 2D shape of the final result and how to get it from two input vectors (1D array).",
    ],
    "statement": """
Implement `pairwise_distances(x, y)`.

Given `x` of shape `(n, d)` and `y` of shape `(m, d)`, return an array `D`
of shape `(n, m)` where `D[i, j]` is the Euclidean distance between `x[i]`
and `y[j]`.

The whole point of this task is to practice broadcasting, so you must
vectorize it.
""",
}
