import time
import pytest
from tools.checks import assert_clean


def test_basic_submit_and_result(impl):
    with impl.ThreadPool(2) as pool:
        fut = pool.submit(lambda x, y: x + y, 3, 4)
        assert fut.result() == 7
        assert fut.done()
        assert fut.exception() is None


def test_args_and_kwargs(impl):
    def greet(greeting, name, punctuation="!"):
        return f"{greeting}, {name}{punctuation}"

    with impl.ThreadPool(2) as pool:
        fut = pool.submit(greet, "Hello", name="Alice", punctuation=".")
        assert fut.result(timeout=1.0) == "Hello, Alice."


def test_concurrency_speedup(impl):
    def slow_task(duration):
        time.sleep(duration)
        return duration

    sleep_time = 0.06
    num_tasks = 4
    num_workers = 4

    t0 = time.monotonic()
    with impl.ThreadPool(num_workers) as pool:
        futures = [pool.submit(slow_task, sleep_time) for _ in range(num_tasks)]
        results = [f.result(timeout=2.0) for f in futures]
    total_time = time.monotonic() - t0

    assert len(results) == num_tasks
    # If executed concurrently with 4 workers, total time should be close to 1x sleep_time,
    # strictly less than 3x sleep_time.
    assert total_time < sleep_time * 3.0


def test_exception_propagation(impl):
    def faulty_task():
        raise KeyError("missing key in task")

    with impl.ThreadPool(2) as pool:
        fut = pool.submit(faulty_task)
        with pytest.raises(KeyError, match="missing key"):
            fut.result(timeout=1.0)

        assert fut.done()
        exc = fut.exception(timeout=1.0)
        assert isinstance(exc, KeyError)
        assert "missing key" in str(exc)


def test_timeout_on_result(impl):
    def hanging_task():
        time.sleep(0.3)
        return "done"

    with impl.ThreadPool(1) as pool:
        fut = pool.submit(hanging_task)
        with pytest.raises(TimeoutError):
            fut.result(timeout=0.03)

        # But eventually completes
        assert fut.result(timeout=1.0) == "done"
        assert fut.done()


def test_submit_after_shutdown_raises(impl):
    pool = impl.ThreadPool(2)
    pool.shutdown(wait=False)
    with pytest.raises(RuntimeError):
        pool.submit(lambda: 42)


def test_shutdown_wait_completes_all_tasks(impl):
    completed = []

    def task(n):
        time.sleep(0.02)
        completed.append(n)

    pool = impl.ThreadPool(2)
    for i in range(6):
        pool.submit(task, i)

    pool.shutdown(wait=True)
    assert len(completed) == 6
    assert sorted(completed) == [0, 1, 2, 3, 4, 5]


def test_invalid_workers(impl):
    with pytest.raises(ValueError):
        impl.ThreadPool(0)
    with pytest.raises(ValueError):
        impl.ThreadPool(-2)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
