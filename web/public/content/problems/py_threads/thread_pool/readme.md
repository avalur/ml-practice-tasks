# Thread Pool

**Topic:** `py_threads` &nbsp;|&nbsp; **Difficulty:** hard

Implement a reusable `ThreadPool` that executes submitted callables across a fixed number of background worker threads, returning `Future` handles for asynchronous result retrieval.

The `concurrent` and `multiprocessing` modules are off-limits.

### Interface

- `Future`:
  - `result(timeout: float | None = None) -> Any`:
    Block until the computation finishes and return its return value. If the task raised an exception, re-raise that exception here. If `timeout` is given and expires before completion, raise `TimeoutError`.
  - `exception(timeout: float | None = None) -> BaseException | None`:
    Block until the computation finishes and return the exception raised, or `None` if it succeeded. If `timeout` expires, raise `TimeoutError`.
  - `done() -> bool`:
    Return `True` if the computation has finished (succeeded or raised).
- `ThreadPool(num_workers: int)`:
  - `submit(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Future`:
    Submit a task to be executed by a worker. Return a `Future` representing the pending result.
    If called after `shutdown()`, raise `RuntimeError`.
  - `shutdown(wait: bool = True) -> None`:
    Signal workers to shut down. No further tasks can be submitted. If `wait=True`, block until all pending tasks and worker threads have finished.
  - Context manager:
    Can be used in a `with ThreadPool(...) as pool:` block; calls `shutdown(wait=True)` on exit.

## Constraints

- Forbidden modules: concurrent, multiprocessing

## How to run

```bash
pytest tasks/py_threads/thread_pool
```
Edit `submission.py` until every test passes.
