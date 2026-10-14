META = {
    "title": "Thread Pool",
    "topic": "py_threads",
    "difficulty": "hard",
    "entry": "ThreadPool",
    "order": 2,
    "py_deps": [],
    "banned": {
        "modules": ["concurrent", "multiprocessing"],
    },
    "prereqs": ["py_threads/bounded_queue"],
    "hints": [
        "Create worker threads that loop pulling tasks from a work queue until a sentinel object (e.g. None) is received.",
        "Future can use threading.Event to signal when the task has produced a result or raised an exception.",
        "When a worker encounters an exception from a task, catch BaseException and store it in the Future so future.result() can re-raise it.",
        "submit() should check if the pool is shutdown and raise RuntimeError if so.",
        "shutdown(wait=True) should enqueue one sentinel per worker thread and join all worker threads.",
    ],
    "statement": """
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
""",
}
