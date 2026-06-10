META = {
    "title": "LRU Cache Decorator",
    "topic": "py_functional",
    "difficulty": "medium",
    "entry": "cache",
    "order": 5,
    "py_deps": [],
    "banned": {
        "names": ["lru_cache"],
    },
    "hints": [
        "Keep an OrderedDict of args -> result. On a hit, move_to_end to mark it most-recently used.",
        "On a miss, store the result; if the size exceeds max_size, popitem(last=False) to drop the least-recently-used entry.",
    ],
    "statement": """
Implement `cache(max_size)` — a decorator factory that memoizes a function,
keeping results for at most the `max_size` **most-recently-used** argument
tuples (an LRU cache). On overflow, evict the least-recently-used entry; a cache
hit refreshes that entry's recency. Preserve the wrapped function's metadata
(`functools.wraps`). Assume positional, hashable arguments.

`functools.lru_cache` is not allowed — build it yourself (e.g. with an
`OrderedDict`).
""",
}
