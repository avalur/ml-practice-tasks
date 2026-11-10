# Implement a Queue

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement a FIFO queue class named `Queue` using two Python lists as stacks.

The queue must provide `enqueue(item)`, `dequeue()`, `peek()`, `is_empty()`,
and `__len__` (so `len(queue)` works). `dequeue` removes and returns the oldest
item; `peek` returns it without removing it. Both raise `IndexError` when the
queue is empty. Any object, including `None`, may be stored.

Do not use the ready-made `queue` or `collections` modules. In particular,
`list.pop(0)` is not suitable: removing the first list element shifts the rest,
so processing many items takes quadratic time. With two stacks, each item can
be moved once and queue operations take amortized O(1) time.

## Constraints

- Forbidden modules: queue, collections
- Forbidden functions: deque

## How to run

```bash
pytest tasks/py_basics/fifo_queue
```
Edit `submission.py` until every test passes.
