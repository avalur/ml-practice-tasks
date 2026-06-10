import numpy as np
import pytest

from tools.checks import assert_clean

CASES = [
    ([1], [[1]]),
    ([1, 2, 3], [[1, 1, 1], [1, 2, 4], [1, 3, 9]]),
    ([1, 1, 1], [[1, 1, 1], [1, 1, 1], [1, 1, 1]]),
    ([2, 5], [[1, 2], [1, 5]]),
]


@pytest.mark.parametrize("array, expected", CASES)
def test_explicit(impl, array, expected):
    np.testing.assert_array_equal(impl.vander(np.array(array)), np.array(expected))


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_numpy(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.integers(1, 10, size=8)
    # Independent oracle: numpy's own Vandermonde (increasing powers).
    np.testing.assert_array_equal(impl.vander(x), np.vander(x, increasing=True))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
