from collections import Counter
import threading
import time
import pytest
from tools.checks import assert_clean


def test_basic_fifo(impl):
    q = impl.BoundedQueue(3)
    assert q.empty()
    assert not q.full()
    assert q.qsize() == 0

    q.put(10)
    q.put(20)
    assert q.qsize() == 2
    assert not q.empty()
    assert not q.full()

    assert q.get() == 10
    assert q.get() == 20
    assert q.empty()
    assert q.qsize() == 0


def test_capacity_and_full_timeout(impl):
    q = impl.BoundedQueue(2)
    q.put("a")
    q.put("b")
    assert q.full()
    assert q.qsize() == 2

    t0 = time.monotonic()
    with pytest.raises(impl.QueueFull):
        q.put("c", timeout=0.05)
    dt = time.monotonic() - t0
    assert dt >= 0.04
    assert q.qsize() == 2


def test_empty_timeout(impl):
    q = impl.BoundedQueue(2)
    assert q.empty()

    t0 = time.monotonic()
    with pytest.raises(impl.QueueEmpty):
        q.get(timeout=0.05)
    dt = time.monotonic() - t0
    assert dt >= 0.04


def test_zero_timeout_immediate(impl):
    q = impl.BoundedQueue(1)
    with pytest.raises(impl.QueueEmpty):
        q.get(timeout=0)

    q.put(42)
    with pytest.raises(impl.QueueFull):
        q.put(99, timeout=0)

    assert q.get(timeout=0) == 42


def test_invalid_capacity(impl):
    with pytest.raises(ValueError):
        impl.BoundedQueue(0)
    with pytest.raises(ValueError):
        impl.BoundedQueue(-5)


def test_concurrent_producers_consumers(impl):
    queue = impl.BoundedQueue(capacity=4)
    num_producers = 4
    num_consumers = 4
    items_per_producer = 50
    total_items = num_producers * items_per_producer

    consumed = []
    consumed_lock = threading.Lock()

    def producer(start_val):
        for i in range(items_per_producer):
            queue.put(start_val + i)

    def consumer():
        while True:
            try:
                item = queue.get(timeout=0.1)
                with consumed_lock:
                    consumed.append(item)
                    if len(consumed) == total_items:
                        return
            except impl.QueueEmpty:
                with consumed_lock:
                    if len(consumed) >= total_items:
                        return

    prod_threads = [
        threading.Thread(target=producer, args=(p * 1000,))
        for p in range(num_producers)
    ]
    cons_threads = [
        threading.Thread(target=consumer)
        for _ in range(num_consumers)
    ]

    for t in cons_threads:
        t.start()
    for t in prod_threads:
        t.start()

    for t in prod_threads:
        t.join(timeout=5.0)
        assert not t.is_alive(), "Producer thread hung"
    for t in cons_threads:
        t.join(timeout=5.0)
        assert not t.is_alive(), "Consumer thread hung"

    assert len(consumed) == total_items
    expected = [p * 1000 + i for p in range(num_producers) for i in range(items_per_producer)]
    assert Counter(consumed) == Counter(expected)
    assert queue.empty()


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
