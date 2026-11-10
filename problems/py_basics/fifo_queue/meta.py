META = {
    "title": "Implement a Queue",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "Queue",
    "order": 10,
    "py_deps": [],
    "banned": {
        "modules": ["queue", "collections"],
        "names": ["deque"],
    },
    "hints": [
        "Keep one list for newly enqueued items and another for items ready to be dequeued.",
        "When the outgoing list is empty, move items from the incoming list by popping and appending them.",
        "Only transfer items when needed; each item should move between the lists at most once.",
    ],
    "statement": """
Implement a FIFO queue class named `Queue` using two Python lists as stacks.

The queue must provide `enqueue(item)`, `dequeue()`, `peek()`, `is_empty()`,
and `__len__` (so `len(queue)` works). `dequeue` removes and returns the oldest
item; `peek` returns it without removing it. Both raise `IndexError` when the
queue is empty. Any object, including `None`, may be stored.

Do not use the ready-made `queue` or `collections` modules. In particular,
`list.pop(0)` is not suitable: removing the first list element shifts the rest,
so processing many items takes quadratic time. With two stacks, each item can
be moved once and queue operations take amortized O(1) time.
""",
}
