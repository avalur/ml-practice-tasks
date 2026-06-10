# Profiler Decorator

**Topic:** `py_functional` &nbsp;|&nbsp; **Difficulty:** medium

Implement `profiler(func)` — a decorator that records, as attributes on the
wrapped function:

- `calls` — the number of invocations during the most recent **top-level** call
  (recursive calls count; the counter resets when a new outermost call begins),
- `last_time_taken` — wall-clock seconds the most recent top-level call took.

Preserve the original function's metadata (`__name__`, `__doc__`, ...) with
`functools.wraps`.

## How to run

```bash
pytest tasks/py_functional/profiler
```
Edit `submission.py` until every test passes.
