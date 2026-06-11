META = {
    "title": "Binary Search",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "find_value",
    "order": 1,
    "py_deps": [],
    "banned": {
        "modules": ["bisect"],
        "names": ["index"],
        "operators": ["in", "not in"],
    },
    "hints": [
        "Keep a [lo, hi] window of indices; compare nums[mid] to value and halve the window each step.",
        "Two returns: True inside the loop on a hit, False after the loop ends.",
    ],
    "statement": """
Implement `find_value(nums, value)`.

`nums` is a list (or `range`) of integers sorted in non-decreasing order; it may
be empty. Return `True` if `value` is present, otherwise `False`. Use **binary
search** — O(log n) time, O(1) extra space.

The `in` operator, the `bisect` module, and `.index()` are not allowed: write
the search yourself. (One test runs on a huge range where a linear scan would
time out.)
""",
}
