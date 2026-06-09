META = {
    "title": "Tile a Row",
    "topic": "numpy_combine",
    "difficulty": "easy",
    "entry": "tile_rows",
    "order": 5,
    "banned": {
        "loops": True,
    },
    "hints": [
        "np.tile(x, (r, 1)) repeats the whole array x to make r identical rows.",
    ],
    "statement": """
Implement `tile_rows(x, r)`.

Given a 1D array `x` of length `n` and an integer `r`, return a 2D array of
shape `(r, n)` in which every one of the `r` rows is a copy of `x`. No
`for`/`while` loops.
""",
}
