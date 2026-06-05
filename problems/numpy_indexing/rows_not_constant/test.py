import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray) -> np.ndarray:
    keep = []
    for i in range(X.shape[0]):
        row = X[i].tolist()
        if max(row) != min(row):
            keep.append(i)
    return X[keep]


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((7, 5))
    X[2] = 3.0   # constant row
    X[5] = -1.0  # constant row
    got = impl.rows_not_constant(X)
    np.testing.assert_array_equal(got, _oracle(X))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
