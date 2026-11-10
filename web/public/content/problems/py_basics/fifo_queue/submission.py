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
        raise NotImplementedError("Your code here")

    def enqueue(self, item: object) -> None:
        """Add ``item`` to the back of the queue."""
        raise NotImplementedError("Your code here")

    def _move_items(self) -> None:
        raise NotImplementedError("Your code here")

    def dequeue(self) -> object:
        """Remove and return the oldest item; raise ``IndexError`` if empty."""
        raise NotImplementedError("Your code here")

    def peek(self) -> object:
        """Return the oldest item without removing it; raise ``IndexError`` if empty."""
        raise NotImplementedError("Your code here")

    def __len__(self) -> int:
        """Return the number of items in the queue."""
        raise NotImplementedError("Your code here")

    def is_empty(self) -> bool:
        """Return whether the queue contains no items."""
        raise NotImplementedError("Your code here")
