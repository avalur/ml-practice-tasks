META = {
    "title": "Minimum Drops to Equal",
    "topic": "py_datastructures",
    "difficulty": "easy",
    "entry": "get_min_to_drop",
    "order": 2,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Count occurrences of each value; the answer is len(seq) minus the largest count.",
    ],
    "statement": """
Implement `get_min_to_drop(seq)`.

Return the minimum number of elements to remove so that all remaining elements
are equal. That equals `len(seq)` minus the count of the most frequent element
(an empty sequence needs 0). For example `get_min_to_drop([1, 2, 3, 1]) == 2`
(drop the 2 and the 3, keep the two 1s).
""",
}
