META = {
    "title": "Iterator Warm-up",
    "topic": "py_functional",
    "difficulty": "easy",
    "entry": "transpose",
    "order": 1,
    "py_deps": [],
    "banned": {},
    "next": ["py_functional/flat_it", "py_functional/context_manager", "py_functional/lru_cache"],
    "hints": [
        "transpose: zip(*matrix) pairs up the columns. uniq: yield items not seen before (it must be a generator).",
        "dict_merge: update a result dict in order (later wins). product: sum of a*b over zip(lhs, rhs).",
    ],
    "statement": """
Four small iterator/collection utilities:

- `transpose(matrix)` — transpose a rectangular matrix (rows ↔ columns).
- `uniq(sequence)` — a **generator** yielding elements in order, dropping later
  duplicates (keep the first occurrence).
- `dict_merge(*dicts)` — merge flat dicts; on a key collision the later dict wins.
- `product(lhs, rhs)` — the scalar (dot) product of two equal-length int lists.
""",
}
