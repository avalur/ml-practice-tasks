import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray, i: int, j: int) -> np.ndarray:
    out = X.copy()
    out[i] = X[j]
    out[j] = X[i]
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((5, 4))
    i, j = 1, 3
    original = X.copy()
    got = impl.swap_rows(X, i, j)
    np.testing.assert_array_equal(got, _oracle(X, i, j))
    np.testing.assert_array_equal(X, original)  # must not mutate input


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
