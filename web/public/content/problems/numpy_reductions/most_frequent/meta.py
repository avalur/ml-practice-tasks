META = {
    "title": "Most Frequent Value",
    "topic": "numpy_reductions",
    "difficulty": "medium",
    "entry": "most_frequent",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.bincount counts occurrences of each value; argmax gives the most frequent.",
    ],
    "statement": """
Implement `most_frequent(x)`.

Given a 1D array `x` of non-negative integers, return the value that occurs
most often. If several values tie, return the smallest of them. No
`for`/`while` loops.
""",
}
