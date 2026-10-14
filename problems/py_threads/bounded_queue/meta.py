META = {
    "title": "Thread-Safe Bounded Queue",
    "topic": "py_threads",
    "difficulty": "easy",
    "entry": "BoundedQueue",
    "order": 1,
    "py_deps": [],
    "banned": {
        "modules": ["queue", "multiprocessing"],
    },
    "hints": [
        "Use a threading.Lock and two threading.Condition variables (or one Condition associated with the lock): not_empty and not_full.",
        "When putting an item, wait on not_full while the queue is full; notify not_empty after appending.",
        "When getting an item, wait on not_empty while the queue is empty; notify not_full after popping.",
        "To handle timeouts accurately, compute deadline = time.monotonic() + timeout and wait for the remaining time in a loop.",
    ],
    "statement": """
Implement a thread-safe bounded FIFO queue `BoundedQueue` coordinating concurrent producers and consumers without busy waiting.

The ready-made `queue` and `multiprocessing` modules are off-limits; use `threading.Lock` and `threading.Condition`.

### Interface

- `QueueEmpty(Exception)`: Exception raised when `get` times out.
- `QueueFull(Exception)`: Exception raised when `put` times out.
- `BoundedQueue(capacity: int)`:
  - `put(item: Any, timeout: float | None = None) -> None`:
    Add an item to the queue. If the queue is full, block until space is available or until `timeout` seconds have elapsed. If `timeout` expires, raise `QueueFull`. If `timeout` is `None`, block indefinitely.
  - `get(timeout: float | None = None) -> Any`:
    Remove and return an item in FIFO order. If the queue is empty, block until an item is available or until `timeout` seconds have elapsed. If `timeout` expires, raise `QueueEmpty`. If `timeout` is `None`, block indefinitely.
  - `qsize() -> int`:
    Return the current number of items in the queue (thread-safe).
  - `empty() -> bool`:
    Return `True` if the queue is empty, `False` otherwise.
  - `full() -> bool`:
    Return `True` if the queue is full, `False` otherwise.
""",
}
