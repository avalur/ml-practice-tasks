META = {
    "title": "Vandermonde Matrix",
    "topic": "numpy_linalg",
    "difficulty": "easy",
    "entry": "vander",
    "banned": {
        "names": ["vander"],
        "loops": True,
    },
    "hints": [
        "Broadcast: array[:, None] raises each element to the powers np.arange(len(array)), giving increasing columns.",
    ],
    "statement": """
Implement `vander(array)`.

Build the Vandermonde matrix with **increasing** powers: the element at row `i`,
column `j` is `array[i] ** j`. A length-`n` vector gives an `n × n` matrix, e.g.
`[1, 2, 3]` → `[[1, 1, 1], [1, 2, 4], [1, 3, 9]]`.

`np.vander` is not allowed — construct it with broadcasting. No `for`/`while`
loops.
""",
}
