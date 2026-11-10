class Queue:
    """A first-in, first-out queue implemented with two stacks.

    ``enqueue(item)`` adds an item, ``dequeue()`` removes and returns the
    oldest item, and ``peek()`` returns the oldest item without removing it.
    Both ``dequeue`` and ``peek`` raise ``IndexError`` when the queue is empty.
    ``len(queue)`` returns the number of items, and ``is_empty()`` reports
    whether there are none. Items may be any object, including ``None``.

    Do not use ``list.pop(0)``: removing the first element shifts every other
    element and makes a sequence of queue operations quadratic. Use two lists
    as stacks so each item is moved at most once.
    """

    def __init__(self) -> None:
        # --- solution: begin ---
        self._incoming: list[object] = []
        self._outgoing: list[object] = []
        # --- solution: end ---

    def enqueue(self, item: object) -> None:
        """Add ``item`` to the back of the queue."""
        # --- solution: begin ---
        self._incoming.append(item)
        # --- solution: end ---

    def _move_items(self) -> None:
        # --- solution: begin ---
        if not self._outgoing:
            while self._incoming:
                self._outgoing.append(self._incoming.pop())
        # --- solution: end ---

    def dequeue(self) -> object:
        """Remove and return the oldest item; raise ``IndexError`` if empty."""
        # --- solution: begin ---
        self._move_items()
        if not self._outgoing:
            raise IndexError("dequeue from empty queue")
        return self._outgoing.pop()
        # --- solution: end ---

    def peek(self) -> object:
        """Return the oldest item without removing it; raise ``IndexError`` if empty."""
        # --- solution: begin ---
        self._move_items()
        if not self._outgoing:
            raise IndexError("peek from empty queue")
        return self._outgoing[-1]
        # --- solution: end ---

    def __len__(self) -> int:
        """Return the number of items in the queue."""
        # --- solution: begin ---
        return len(self._incoming) + len(self._outgoing)
        # --- solution: end ---

    def is_empty(self) -> bool:
        """Return whether the queue contains no items."""
        # --- solution: begin ---
        return not self._incoming and not self._outgoing
        # --- solution: end ---
