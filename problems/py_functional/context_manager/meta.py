META = {
    "title": "Context Managers",
    "topic": "py_functional",
    "difficulty": "medium",
    "entry": "supresser",
    "order": 3,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Use @contextlib.contextmanager: put `yield` inside a try/except so the with-body runs at the yield.",
        "supresser swallows listed types; retyper raises type_to(*e.args) from the caught error; dumper prints then re-raises.",
    ],
    "statement": """
Implement three context managers (with `@contextlib.contextmanager`):

- `supresser(*types_)` — suppress exceptions whose type is listed (the block
  exits normally); other exceptions propagate.
- `retyper(type_from, type_to)` — catch `type_from` and re-raise it as
  `type_to`, preserving the exception's `args`.
- `dumper(stream=None)` — on any exception, write its message to `stream`
  (default `sys.stderr`), then re-raise.
""",
}
