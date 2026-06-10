import numpy as np
import pytest

from tools.checks import assert_clean


def test_explicit(impl):
    cases = [
        (np.arange(0, 10).reshape((2, 5)).astype(float), 3.6, 4.0),
        (np.arange(0, 10).reshape((10, 1)).astype(float), 0.6, 1.0),
        (np.zeros((5, 10)), 20.0, 0.0),
        (np.array([[1.0, 0.0, 0.0]]), 0.9, 1.0),
        (np.array([[1.0]]), 1_000_000.0, 1.0),
    ]
    for matrix, value, expected in cases:
        assert np.isclose(impl.nearest_value(matrix, value), expected)


def test_empty_returns_none(impl):
    assert impl.nearest_value(np.array([[]]), 0.0) is None


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_value_present_returns_itself(impl, rng_for, seed):
    rng = rng_for(seed)
    matrix = rng.standard_normal((7, 9))
    # An element that's literally in the matrix is its own nearest value.
    picked = float(rng.choice(matrix.ravel()))
    assert np.isclose(impl.nearest_value(matrix, picked), picked)


@pytest.mark.parametrize("seed", [3, 4])
def test_matches_brute_force(impl, rng_for, seed):
    rng = rng_for(seed)
    matrix = rng.standard_normal((5, 5))
    value = 0.123
    flat = matrix.ravel()
    expected = flat[min(range(flat.size), key=lambda i: abs(flat[i] - value))]
    assert np.isclose(impl.nearest_value(matrix, value), expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
