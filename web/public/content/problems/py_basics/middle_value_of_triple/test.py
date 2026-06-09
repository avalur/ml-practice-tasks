import pytest

from tools.checks import assert_clean

CASES = [
    (1, 2, 3), (3, 2, 1), (2, 3, 1), (2, 1, 3), (3, 1, 2), (1, 3, 2),
    (-100, -10, 100), (100, -10, -100), (-10, -10, -5), (-10, -10, -10),
    (-100, 10, 100), (0, 0, 0), (10**12, -10**12, 10**10),
]


@pytest.mark.parametrize("a, b, c", CASES)
def test_get_middle_value(impl, a, b, c):
    # Independent oracle: sorting is allowed in trusted test code.
    assert impl.get_middle_value(a, b, c) == sorted([a, b, c])[1]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
