META = {
    "title": "Checkerboard",
    "topic": "numpy_manipulation",
    "difficulty": "easy",
    "entry": "checkerboard",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Start from zeros and set alternating slices to 1: Z[1::2, ::2] and Z[::2, 1::2].",
    ],
    "statement": """
Implement `checkerboard(n)`.

Return an `(n, n)` integer array filled with a 0/1 checkerboard pattern where
the top-left cell `[0, 0]` is `0` (so cell `[i, j]` is `(i + j) % 2`). Use
slicing — no `for`/`while` loops.
""",
}
