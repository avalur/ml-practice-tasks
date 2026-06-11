META = {
    "title": "K-Way Merge (Heap)",
    "topic": "py_datastructures",
    "difficulty": "medium",
    "entry": "merge",
    "order": 4,
    "py_deps": [],
    "banned": {
        "names": ["sorted"],
        "slicing": True,
    },
    "prereqs": ["py_basics/merge_iterative"],
    "hints": [
        "Push the first element of each non-empty list onto a heap as (value, list_index, elem_index).",
        "Pop the smallest, emit it, and push the next element from that same list. Repeat until the heap is empty.",
    ],
    "statement": """
Implement `merge(lists)`.

Merge `k` lists — each already sorted in non-decreasing order — into one sorted
list, using a **heap** (`heapq`) for an O(N log k) merge. Don't concatenate and
`sorted`, and don't slice. Leave the inputs unchanged. For example
`merge([[1, 4, 7], [2, 3, 8], [0, 5, 9]]) == [0, 1, 2, 3, 4, 5, 7, 8, 9]`.
""",
}
