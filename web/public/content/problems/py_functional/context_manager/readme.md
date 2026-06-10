# Context Managers

**Topic:** `py_functional` &nbsp;|&nbsp; **Difficulty:** medium

Implement three context managers (with `@contextlib.contextmanager`):

- `supresser(*types_)` — suppress exceptions whose type is listed (the block
  exits normally); other exceptions propagate.
- `retyper(type_from, type_to)` — catch `type_from` and re-raise it as
  `type_to`, preserving the exception's `args`.
- `dumper(stream=None)` — on any exception, write its message to `stream`
  (default `sys.stderr`), then re-raise.

## How to run

```bash
pytest tasks/py_functional/context_manager
```
Edit `submission.py` until every test passes.
