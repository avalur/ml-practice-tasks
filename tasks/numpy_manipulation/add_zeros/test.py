import numpy as np
import pytest

from tools.checks import assert_clean

CASES = [
    ([1, 2, 3], [1, 0, 2, 0, 3]),
    ([], []),
    ([1], [1]),
    ([1, 1], [1, 0, 1]),
    ([0], [0]),
    ([1, 0, 0, 1], [1, 0, 0, 0, 0, 0, 1]),
    ([5, 4, 3, 2], [5, 0, 4, 0, 3, 0, 2]),
]


@pytest.mark.parametrize("x, expected", CASES)
def test_add_zeros(impl, x, expected):
    out = impl.add_zeros(np.array(x, dtype=np.int_))
    np.testing.assert_array_equal(out, np.array(expected, dtype=np.int_))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
