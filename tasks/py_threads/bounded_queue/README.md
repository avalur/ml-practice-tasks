# Thread-Safe Bounded Queue

**Topic:** `py_threads` &nbsp;|&nbsp; **Difficulty:** easy

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

## Constraints

- Forbidden modules: queue, multiprocessing

## How to run

```bash
pytest tasks/py_threads/bounded_queue
```
Edit `submission.py` until every test passes.
