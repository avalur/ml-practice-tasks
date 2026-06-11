META = {
    "title": "Flatten It (generator)",
    "topic": "py_functional",
    "difficulty": "medium",
    "entry": "flat_it",
    "order": 2,
    "py_deps": [],
    "banned": {},
    "prereqs": ["py_functional/warm_up", "py_basics/iterate_me"],
    "hints": [
        "Iterate the sequence; if an item is iterable, `yield from flat_it(item)`, else `yield item`.",
        "Treat strings carefully: a string is iterable, so stop recursing once you reach a single character.",
    ],
    "statement": """
Implement `flat_it(sequence)` as a **generator** that lazily flattens an
iterable with an arbitrary level of nesting into a flat stream of leaves, in
order. For example `list(flat_it((1, (2, 3), [4, [5, 6], 7]))) == [1, 2, 3, 4,
5, 6, 7]`.

Strings are iterable, so a multi-character string flattens into its characters
(`"ab"` → `"a", "b"`); stop recursing at a single character so iterating a
1-char string terminates. Non-iterables are yielded as-is. Use `yield` (the
result must be a generator).
""",
}
