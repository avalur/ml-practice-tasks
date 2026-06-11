META = {
    "title": "Custom Range",
    "topic": "py_classes",
    "difficulty": "medium",
    "entry": "Range",
    "order": 1,
    "py_deps": [],
    "banned": {},
    "next": ["py_classes/list_twist"],
    "hints": [
        "Store start/stop/step and precompute the length; __getitem__ returns start + index*step (map negative indices via len + index).",
        "Make __contains__ O(1) arithmetic (in-bounds and (key-start) % step == 0); return a fresh iterator from __iter__ so it's re-iterable.",
    ],
    "statement": """
Implement a `Range` class (plus its `RangeIterator`) that mimics the built-in
`range`: an immutable arithmetic sequence.

`Range(stop)`, `Range(start, stop)`, or `Range(start, stop, step)` — `start`
defaults to 0, `step` to 1, and `step == 0` raises `ValueError`. Support
iteration (re-iterable), `len`, indexing with negative indices (`IndexError`
when out of range), membership (`in`) in **O(1)**, and a `range`-style `repr`
(`str(Range(10)) == "range(0, 10)"`).
""",
}
