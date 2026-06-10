import pytest

from tools.checks import assert_clean

BIG = 10**15


def _median(a, b):
    # Independent oracle: merge by sorting (allowed in trusted test code).
    c = sorted(list(a) + list(b))
    k = len(c)
    return (c[(k - 1) // 2] + c[k // 2]) / 2


SMALL = [
    ([1], [2]), ([2], [1]), ([], [2]), ([1], []),
    ([1, 2], []), ([1, 2, 3], []), ([1, 2, 3, 5, 7], []),
    ([-1, -1, -1], [-1, -1, -1]), ([1, 2], [1, 2]), ([1, 3], [2]), ([2], [1, 3]),
    ([2], [1, 3, 4]), ([3], [1, 2, 4]), ([1, 3, 4], [2]), ([2, 6], [3, 4]),
    ([1, 2, 2, 2, 3, 4, 5], [1, 2, 6, 7, 8, 8, 9]), ([1, 2, 3, 4, 5], [1, 2, 3]),
    ([1, 3, 5, 7], [2, 4, 6, 8]), ([1, 3, 5, 7], [-1, 2, 4, 6, 8]),
    ([-1, 5, 8, 17], [-7, 15, 20]), ([1, 2], [3, 4, 5]),
    ([3, 4, 5, 6, 7, 8], [1, 2]), ([1, 1, 2, 5, 6], [1, 9, 10]),
    (list(range(0, 100, 2)), list(range(-100, 100, 5))),
]


@pytest.mark.parametrize("a, b", SMALL)
def test_small(impl, a, b):
    expected = _median(a, b)
    got = impl.find_median(a, b)
    assert isinstance(got, float), "should always return a float"
    assert got == expected
    assert impl.find_median(b, a) == expected, "result must not depend on argument order"


BIG_CASES = [
    (range(0, BIG + 1), [], BIG / 2),
    (range(0, BIG), [], (BIG - 1) / 2),
    (range(0, BIG, 2), range(0, BIG, 5), BIG / 2 - 1),
    (range(0, BIG + 1, 2), range(0, BIG + 1, 5), BIG / 2),
    (range(0, BIG + 1, 2), range(0, BIG * 10, 5), BIG / 4 * 15 - 5),
]


@pytest.mark.parametrize("a, b, expected", BIG_CASES)
def test_big_ranges_need_log_time(impl, a, b, expected):
    # ~10**15 elements: only an O(log) partition search returns in time.
    got = impl.find_median(a, b)
    assert isinstance(got, float)
    assert got == expected
    assert impl.find_median(b, a) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
