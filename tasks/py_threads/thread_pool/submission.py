from collections.abc import Callable
import queue
import threading
from typing import Any


class Future:
    """Represents the eventual result of an asynchronous computation."""

    def __init__(self) -> None:
        """Initialize a pending Future."""
        raise NotImplementedError("Your code here")

    def _set_result(self, result: Any) -> None:
        """Set the result and notify all waiters."""
        raise NotImplementedError("Your code here")

    def _set_exception(self, exception: BaseException) -> None:
        """Set the exception and notify all waiters."""
        raise NotImplementedError("Your code here")

    def result(self, timeout: float | None = None) -> Any:
        """Wait for the computation to finish and return its result.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Return value of the task.
        :raises TimeoutError: If timeout expires before the task completes.
        :raises Exception: Re-raises any exception raised by the task.
        """
        raise NotImplementedError("Your code here")

    def exception(self, timeout: float | None = None) -> BaseException | None:
        """Wait for the computation to finish and return the exception raised, or None if successful.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Exception instance if the task raised, None if it succeeded.
        :raises TimeoutError: If timeout expires before the task completes.
        """
        raise NotImplementedError("Your code here")

    def done(self) -> bool:
        """Return True if the computation has finished, False otherwise."""
        raise NotImplementedError("Your code here")


class ThreadPool:
    """Pool of worker threads executing tasks asynchronously."""

    def __init__(self, num_workers: int) -> None:
        """Initialize the thread pool with a fixed number of workers.

        :param num_workers: Number of worker threads (> 0).
        """
        raise NotImplementedError("Your code here")

    def _worker_loop(self) -> None:
        """Worker loop that runs in each thread."""
        raise NotImplementedError("Your code here")

    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Future:
        """Submit a callable to be executed asynchronously.

        :param fn: Function or callable to run.
        :param args: Positional arguments for fn.
        :param kwargs: Keyword arguments for fn.
        :return: A Future representing the computation.
        :raises RuntimeError: If submit is called after shutdown.
        """
        raise NotImplementedError("Your code here")

    def shutdown(self, wait: bool = True) -> None:
        """Signal worker threads to terminate.

        :param wait: If True, block until all queued tasks and workers finish.
        """
        raise NotImplementedError("Your code here")

    def __enter__(self) -> "ThreadPool":
        """Enter context manager."""
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit context manager, waiting for pending tasks."""
        self.shutdown(wait=True)
