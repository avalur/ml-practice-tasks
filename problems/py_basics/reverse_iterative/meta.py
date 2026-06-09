META = {
    "title": "Reverse a List by Hand",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "reverse_iterative",
    "order": 6,
    "py_deps": [],
    "banned": {
        "names": ["reversed"],
        "slicing": True,
    },
    "hints": [
        "Iterate indices from len(lst)-1 down to 0 with range(len(lst)-1, -1, -1) and append.",
    ],
    "statement": """
Implement `reverse_iterative(lst)`.

Return a **new** list with the elements of `lst` in reverse order; leave the
input unchanged. For example `reverse_iterative([1, 2, 3]) == [3, 2, 1]`.

Use **iteration only**: the `reversed` builtin and slicing (`lst[::-1]`) are not
allowed.
""",
}
