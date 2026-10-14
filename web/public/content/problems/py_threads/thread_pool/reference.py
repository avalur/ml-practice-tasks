from collections.abc import Callable
import queue
import threading
from typing import Any


class Future:
    """Represents the eventual result of an asynchronous computation."""

    def __init__(self) -> None:
        """Initialize a pending Future."""
        self._done_event = threading.Event()
        self._result: Any = None
        self._exception: BaseException | None = None

    def _set_result(self, result: Any) -> None:
        """Set the result and notify all waiters."""
        self._result = result
        self._done_event.set()

    def _set_exception(self, exception: BaseException) -> None:
        """Set the exception and notify all waiters."""
        self._exception = exception
        self._done_event.set()

    def result(self, timeout: float | None = None) -> Any:
        """Wait for the computation to finish and return its result.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Return value of the task.
        :raises TimeoutError: If timeout expires before the task completes.
        :raises Exception: Re-raises any exception raised by the task.
        """
        if not self._done_event.wait(timeout):
            raise TimeoutError("Task timed out before completing")
        if self._exception is not None:
            raise self._exception
        return self._result

    def exception(self, timeout: float | None = None) -> BaseException | None:
        """Wait for the computation to finish and return the exception raised, or None if successful.

        :param timeout: Maximum seconds to wait. None waits indefinitely.
        :return: Exception instance if the task raised, None if it succeeded.
        :raises TimeoutError: If timeout expires before the task completes.
        """
        if not self._done_event.wait(timeout):
            raise TimeoutError("Task timed out before completing")
        return self._exception

    def done(self) -> bool:
        """Return True if the computation has finished, False otherwise."""
        return self._done_event.is_set()


class ThreadPool:
    """Pool of worker threads executing tasks asynchronously."""

    def __init__(self, num_workers: int) -> None:
        """Initialize the thread pool with a fixed number of workers.

        :param num_workers: Number of worker threads (> 0).
        """
        if num_workers <= 0:
            raise ValueError("num_workers must be greater than 0")
        self._num_workers = num_workers
        self._queue: queue.Queue[Any] = queue.Queue()
        self._shutdown = False
        self._lock = threading.Lock()
        self._workers: list[threading.Thread] = []

        for i in range(num_workers):
            t = threading.Thread(target=self._worker_loop, name=f"ThreadPoolWorker-{i}")
            t.daemon = True
            t.start()
            self._workers.append(t)

    def _worker_loop(self) -> None:
        """Worker loop that runs in each thread."""
        while True:
            item = self._queue.get()
            if item is None:
                self._queue.task_done()
                break
            future, fn, args, kwargs = item
            try:
                res = fn(*args, **kwargs)
                future._set_result(res)
            except BaseException as exc:
                future._set_exception(exc)
            finally:
                self._queue.task_done()

    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Future:
        """Submit a callable to be executed asynchronously.

        :param fn: Function or callable to run.
        :param args: Positional arguments for fn.
        :param kwargs: Keyword arguments for fn.
        :return: A Future representing the computation.
        :raises RuntimeError: If submit is called after shutdown.
        """
        with self._lock:
            if self._shutdown:
                raise RuntimeError("Cannot submit tasks to a closed ThreadPool")
            future = Future()
            self._queue.put((future, fn, args, kwargs))
            return future

    def shutdown(self, wait: bool = True) -> None:
        """Signal worker threads to terminate.

        :param wait: If True, block until all queued tasks and workers finish.
        """
        with self._lock:
            if self._shutdown:
                return
            self._shutdown = True
            for _ in range(self._num_workers):
                self._queue.put(None)

        if wait:
            for t in self._workers:
                t.join()

    def __enter__(self) -> "ThreadPool":
        """Enter context manager."""
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit context manager, waiting for pending tasks."""
        self.shutdown(wait=True)
