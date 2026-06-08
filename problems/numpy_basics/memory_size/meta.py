META = {
    "title": "Memory Size of an Array",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "memory_size",
    "order": 2,
    "banned": {
        "names": ["nbytes"],
    },
    "hints": [
        "An array holds a.size elements, each a.itemsize bytes — multiply them.",
    ],
    "statement": """
Implement `memory_size(a)`.

Return the total number of bytes the array `a` occupies in memory — the
number of elements times the number of bytes per element. Compute it from
`a.size` and `a.itemsize` (the `nbytes` shortcut is not allowed).
""",
}
