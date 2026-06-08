META = {
    "title": "Null Vector With a One",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "null_with_one",
    "order": 4,
    "banned": {
        "loops": True,
    },
    "hints": [
        "Make a zero vector with np.zeros(n), then assign 1 to index i.",
    ],
    "statement": """
Implement `null_with_one(n, i)`.

Return a length-`n` vector of zeros (dtype float) whose value at index `i`
is `1`. For example, `null_with_one(10, 4)` is a size-10 null vector whose
fifth value (index 4) is 1. No `for`/`while` loops.
""",
}
