import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray, k: int) -> np.ndarray:
    order = sorted(range(X.shape[0]), key=lambda i: X[i, k])
    return X[order]


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((8, 4))
    k = int(rng.integers(0, 4))
    np.testing.assert_array_equal(impl.sort_by_column(X, k), _oracle(X, k))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
