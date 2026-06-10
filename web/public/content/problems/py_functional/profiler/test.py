from datetime import datetime

from tools.checks import assert_clean


def _make_ackermann(impl):
    @impl.profiler
    def ackermann(m, n):
        if m == 0:
            return n + 1
        if n == 0:
            return ackermann(m - 1, 1)
        return ackermann(m - 1, ackermann(m, n - 1))
    return ackermann


def test_calls_and_result(impl):
    ack = _make_ackermann(impl)
    start = datetime.now()
    result = ack(3, 2)
    delta = (datetime.now() - start).total_seconds()
    assert result == 29
    assert ack.calls == 541
    assert 0 <= ack.last_time_taken <= delta + 0.5


def test_calls_reset_per_top_call(impl):
    ack = _make_ackermann(impl)
    ack(0, 1)            # 1 call
    ack(3, 2)            # resets, then counts 541
    assert ack.calls == 541


def test_preserves_metadata(impl):
    @impl.profiler
    def f():
        """a docstring"""
        return 1
    assert f.__name__ == "f"
    assert f.__doc__ == "a docstring"


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
