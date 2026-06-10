META = {
    "title": "Profiler Decorator",
    "topic": "py_functional",
    "difficulty": "medium",
    "entry": "profiler",
    "order": 4,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Track recursion depth on the wrapper; reset `calls` to 0 only when entering at depth 0 (a new top-level call).",
        "Record `last_time_taken` when the depth returns to 0; use functools.wraps to keep the function's metadata.",
    ],
    "statement": """
Implement `profiler(func)` — a decorator that records, as attributes on the
wrapped function:

- `calls` — the number of invocations during the most recent **top-level** call
  (recursive calls count; the counter resets when a new outermost call begins),
- `last_time_taken` — wall-clock seconds the most recent top-level call took.

Preserve the original function's metadata (`__name__`, `__doc__`, ...) with
`functools.wraps`.
""",
}
