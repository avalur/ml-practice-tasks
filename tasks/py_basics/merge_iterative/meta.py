META = {
    "title": "Merge Two Sorted Lists",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "merge_iterative",
    "order": 5,
    "py_deps": [],
    "banned": {
        "names": ["sorted"],
        "slicing": True,
    },
    "next": ["py_datastructures/merge_kway"],
    "hints": [
        "Two pointers i, j: append the smaller of lst_a[i] / lst_b[j], advance that pointer.",
        "When one list is exhausted, drain the other with a plain loop (no slicing).",
    ],
    "statement": """
Implement `merge_iterative(lst_a, lst_b)`.

Both inputs are sorted in non-decreasing order. Return one merged sorted list —
the classic merge step of merge sort, done **by hand**. Leave the inputs
unchanged. For example `merge_iterative([1, 3], [2, 4]) == [1, 2, 3, 4]`.

`sorted` and slicing (`seq[a:b]`) are not allowed — use two pointers,
O(len(a) + len(b)).
""",
}
