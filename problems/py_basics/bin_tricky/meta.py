META = {
    "title": "Median of Two Sorted Sequences",
    "topic": "py_basics",
    "difficulty": "hard",
    "entry": "find_median",
    "order": 9,
    "py_deps": [],
    "banned": {
        "names": ["sorted", "index"],
        "operators": ["in", "not in"],
    },
    "prereqs": ["py_basics/bin_basic"],
    "hints": [
        "Binary-search the partition of the SHORTER sequence: pick i from it and j = (m+n+1)//2 - i from the other so the left part has half the elements.",
        "The partition is correct when a[i-1] <= b[j] and b[j-1] <= a[i] (use ±infinity at the edges); then the median comes from the boundary values.",
    ],
    "statement": """
Implement `find_median(nums1, nums2)`.

Both inputs are sorted in non-decreasing order (at least one is non-empty).
Return their combined median as a `float`: the middle value if the total length
is odd, otherwise the average of the two middle values.

Run in **O(log(min(m, n)))** — a binary search over the partition, not a merge
(some tests use sequences of hundreds of millions of elements, where scanning
would never finish). `sorted`, `.index()`, and the `in` operator are not allowed.
""",
}
