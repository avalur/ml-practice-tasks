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
        self._incoming: list[object] = []
        self._outgoing: list[object] = []

    def enqueue(self, item: object) -> None:
        """Add ``item`` to the back of the queue."""
        self._incoming.append(item)

    def _move_items(self) -> None:
        if not self._outgoing:
            while self._incoming:
                self._outgoing.append(self._incoming.pop())

    def dequeue(self) -> object:
        """Remove and return the oldest item; raise ``IndexError`` if empty."""
        self._move_items()
        if not self._outgoing:
            raise IndexError("dequeue from empty queue")
        return self._outgoing.pop()

    def peek(self) -> object:
        """Return the oldest item without removing it; raise ``IndexError`` if empty."""
        self._move_items()
        if not self._outgoing:
            raise IndexError("peek from empty queue")
        return self._outgoing[-1]

    def __len__(self) -> int:
        """Return the number of items in the queue."""
        return len(self._incoming) + len(self._outgoing)

    def is_empty(self) -> bool:
        """Return whether the queue contains no items."""
        return not self._incoming and not self._outgoing
