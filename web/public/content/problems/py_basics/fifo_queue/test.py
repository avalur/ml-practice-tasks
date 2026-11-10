import random
import time

import pytest

from tools.checks import assert_clean


def test_fifo_operations(impl):
    queue = impl.Queue()
    assert len(queue) == 0
    assert queue.is_empty()
    with pytest.raises(IndexError):
        queue.dequeue()
    with pytest.raises(IndexError):
        queue.peek()

    for item in ("first", None, "last"):
        queue.enqueue(item)

    assert len(queue) == 3
    assert not queue.is_empty()
    assert queue.peek() == "first"
    assert queue.dequeue() == "first"
    assert queue.peek() is None
    assert queue.dequeue() is None
    assert queue.dequeue() == "last"
    assert queue.is_empty()


@pytest.mark.parametrize("seed", [0, 17, 2025])
def test_randomized_operations_against_list(seed, impl):
    rng = random.Random(seed)
    queue = impl.Queue()
    expected = []

    for _ in range(600):
        operation = rng.choice(("enqueue", "dequeue", "peek"))
        if operation == "enqueue" or not expected:
            item = rng.choice((None, rng.randint(-100, 100), "item"))
            queue.enqueue(item)
            expected.append(item)
        elif operation == "dequeue":
            assert queue.dequeue() == expected.pop(0)
        else:
            assert queue.peek() == expected[0]

        assert len(queue) == len(expected)
        assert queue.is_empty() == (not expected)


def test_queues_are_independent(impl):
    first = impl.Queue()
    second = impl.Queue()
    first.enqueue(1)
    second.enqueue(2)

    assert first.dequeue() == 1
    assert first.is_empty()
    assert second.dequeue() == 2


def test_large_queue_operations_are_efficient(impl):
    queue = impl.Queue()
    count = 200_000

    started = time.perf_counter()
    for item in range(count):
        queue.enqueue(item)
    for item in range(count):
        assert queue.dequeue() == item
    elapsed = time.perf_counter() - started

    assert elapsed < 3.0, f"{count} FIFO operations took {elapsed:.2f}s"
    assert queue.is_empty()


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
