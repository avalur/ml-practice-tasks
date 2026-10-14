from collections import deque
import threading
import time
from typing import Any


class QueueEmpty(Exception):
    """Raised when getting an item from an empty queue times out."""


class QueueFull(Exception):
    """Raised when putting an item into a full queue times out."""


class BoundedQueue:
    """Thread-safe bounded FIFO queue for concurrent producers and consumers."""

    def __init__(self, capacity: int) -> None:
        """Initialize the queue with a maximum capacity.

        :param capacity: Maximum number of items the queue can hold (> 0).
        """
        raise NotImplementedError("Your code here")

    def put(self, item: Any, timeout: float | None = None) -> None:
        """Add an item to the queue, blocking until space is available or timeout expires.

        :param item: Item to add.
        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :raises QueueFull: If the queue remains full after the timeout expires.
        """
        raise NotImplementedError("Your code here")

    def get(self, timeout: float | None = None) -> Any:
        """Remove and return an item from the queue, blocking until available or timeout expires.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Next item in FIFO order.
        :raises QueueEmpty: If the queue remains empty after the timeout expires.
        """
        raise NotImplementedError("Your code here")

    def qsize(self) -> int:
        """Return the current number of items in the queue."""
        raise NotImplementedError("Your code here")

    def empty(self) -> bool:
        """Return True if the queue is empty, False otherwise."""
        raise NotImplementedError("Your code here")

    def full(self) -> bool:
        """Return True if the queue is full, False otherwise."""
        raise NotImplementedError("Your code here")
