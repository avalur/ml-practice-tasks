# LRU Cache Decorator

**Topic:** `py_functional` &nbsp;|&nbsp; **Difficulty:** medium

Implement `cache(max_size)` — a decorator factory that memoizes a function,
keeping results for at most the `max_size` **most-recently-used** argument
tuples (an LRU cache). On overflow, evict the least-recently-used entry; a cache
hit refreshes that entry's recency. Preserve the wrapped function's metadata
(`functools.wraps`). Assume positional, hashable arguments.

`functools.lru_cache` is not allowed — build it yourself (e.g. with an
`OrderedDict`).

## Constraints

- Forbidden functions: lru_cache

## How to run

```bash
pytest tasks/py_functional/lru_cache
```
Edit `submission.py` until every test passes.
