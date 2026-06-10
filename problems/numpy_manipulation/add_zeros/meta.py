META = {
    "title": "Interleave Zeros Between Elements",
    "topic": "numpy_manipulation",
    "difficulty": "easy",
    "entry": "add_zeros",
    "banned": {
        "loops": True,
    },
    "hints": [
        "Allocate a zero array of length 2*len(x)-1, then write x into every other slot with a strided assignment out[::2] = x.",
    ],
    "statement": """
Implement `add_zeros(x)`.

Given a 1D integer array `x`, return a new array with a single zero inserted
between each pair of adjacent elements: `[1, 2, 3]` → `[1, 0, 2, 0, 3]`. An
array with fewer than two elements is returned unchanged. No `for`/`while`
loops — use a strided assignment.
""",
}
