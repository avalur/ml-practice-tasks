META = {
    "title": "Flatten a Nested Dictionary",
    "topic": "py_datastructures",
    "difficulty": "medium",
    "entry": "traverse_dictionary_immutable",
    "order": 3,
    "py_deps": [],
    "banned": {},
    "hints": [
        "At each level join the path with '.'; recurse into dict values, otherwise emit (full_key, value).",
        "For the iterative version keep an explicit stack of (prefix, subdict) so deep nesting can't overflow the recursion limit.",
    ],
    "statement": """
Implement three flatteners of an arbitrarily nested dict whose leaves are ints:
turn it into `(dotted_key, value)` pairs, e.g.
`{"a": {"b": 1}}` → `[("a.b", 1)]`. Key order in the result doesn't matter.

- `traverse_dictionary_immutable(dct, prefix="")` — recursion that **returns** a
  new list.
- `traverse_dictionary_mutable(dct, result, prefix="")` — recursion that
  **appends** to the given `result` list (returns `None`).
- `traverse_dictionary_iterative(dct)` — **no recursion**: use an explicit stack
  so it survives very deep nesting (100000 levels).

Don't modify the input dict.
""",
}
