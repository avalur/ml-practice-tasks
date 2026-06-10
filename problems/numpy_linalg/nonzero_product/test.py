import numpy as np
import pytest

from tools.checks import assert_clean

CASES = [
    (np.array([[1, 0, 1], [2, 0, 2], [3, 0, 3], [4, 4, 4]]), 3),
    (np.array([[0, 0, 1], [2, 0, 2], [3, 0, 0], [4, 4, 4]]), None),
    (np.array([[], [], [], []], dtype=np.int_), None),
    (np.arange(24).reshape((4, 6)), 2058),
    (np.ones(48, dtype=np.int_).reshape((12, 4)), 1),
    (np.zeros(48, dtype=np.int_).reshape((12, 4)), None),
    (np.array([[1]]), 1),
    (np.array([[0]]), None),
    (np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]]), 1),
]


@pytest.mark.parametrize("matrix, expected", CASES)
def test_nonzero_product(impl, matrix, expected):
    assert impl.nonzero_product(matrix) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
