META = {
    "title": "Invert a Dictionary",
    "topic": "py_datastructures",
    "difficulty": "easy",
    "entry": "revert",
    "order": 1,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Walk the items once; for each (key, value) append key to the list at out[value] (dict.setdefault keeps it one pass).",
    ],
    "statement": """
Implement `revert(dct)`.

Invert a `{key: value}` mapping into `{value: [keys...]}`: each value becomes a
key whose list holds every original key that mapped to it. Don't modify the
input. For example `revert({"a": "1", "b": "2", "c": "1"})` →
`{"1": ["a", "c"], "2": ["b"]}` (key order within a list doesn't matter). Do it
in O(n) — a single pass, not O(n^2).
""",
}
