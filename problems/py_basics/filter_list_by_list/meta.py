META = {
    "title": "Filter Sorted List by List",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "filter_list_by_list",
    "order": 4,
    "py_deps": [],
    "banned": {
        "names": ["set"],
    },
    "next": ["py_datastructures/comprehensions"],
    "hints": [
        "Both lists are sorted: walk them with two pointers, advancing the second past values smaller than the current element.",
        "Drop the element when the two pointers meet on equal values; otherwise keep it.",
    ],
    "statement": """
Implement `filter_list_by_list(lst_a, lst_b)`.

Both inputs are sorted in non-decreasing order. Return a **new** list with the
elements of `lst_a` that do **not** appear in `lst_b`, preserving order and
duplicates; leave the inputs unchanged. For example
`filter_list_by_list([2, 3], [1, 2]) == [3]`.

`set` is not allowed — use the fact that both lists are sorted and walk them
with two pointers in O(len(a) + len(b)).
""",
}
