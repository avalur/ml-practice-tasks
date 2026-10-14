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
        if capacity <= 0:
            raise ValueError("capacity must be greater than 0")
        self._capacity = capacity
        self._queue: deque[Any] = deque()
        self._lock = threading.Lock()
        self._not_empty = threading.Condition(self._lock)
        self._not_full = threading.Condition(self._lock)

    def put(self, item: Any, timeout: float | None = None) -> None:
        """Add an item to the queue, blocking until space is available or timeout expires.

        :param item: Item to add.
        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :raises QueueFull: If the queue remains full after the timeout expires.
        """
        with self._lock:
            if timeout is not None and timeout <= 0:
                if len(self._queue) >= self._capacity:
                    raise QueueFull("Queue is full")
            elif timeout is not None:
                deadline = time.monotonic() + timeout
                while len(self._queue) >= self._capacity:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise QueueFull("Queue is full")
                    self._not_full.wait(remaining)
            else:
                while len(self._queue) >= self._capacity:
                    self._not_full.wait()

            self._queue.append(item)
            self._not_empty.notify()

    def get(self, timeout: float | None = None) -> Any:
        """Remove and return an item from the queue, blocking until available or timeout expires.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Next item in FIFO order.
        :raises QueueEmpty: If the queue remains empty after the timeout expires.
        """
        with self._lock:
            if timeout is not None and timeout <= 0:
                if not self._queue:
                    raise QueueEmpty("Queue is empty")
            elif timeout is not None:
                deadline = time.monotonic() + timeout
                while not self._queue:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise QueueEmpty("Queue is empty")
                    self._not_empty.wait(remaining)
            else:
                while not self._queue:
                    self._not_empty.wait()

            item = self._queue.popleft()
            self._not_full.notify()
            return item

    def qsize(self) -> int:
        """Return the current number of items in the queue."""
        with self._lock:
            return len(self._queue)

    def empty(self) -> bool:
        """Return True if the queue is empty, False otherwise."""
        with self._lock:
            return len(self._queue) == 0

    def full(self) -> bool:
        """Return True if the queue is full, False otherwise."""
        with self._lock:
            return len(self._queue) >= self._capacity
