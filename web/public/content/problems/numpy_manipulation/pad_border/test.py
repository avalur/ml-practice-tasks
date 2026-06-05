import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray) -> np.ndarray:
    m, n = X.shape
    out = np.zeros((m + 2, n + 2), dtype=X.dtype)
    for i in range(m):
        for j in range(n):
            out[i + 1, j + 1] = X[i, j]
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((4, 3))
    got = impl.pad_border(X)
    assert got.shape == (6, 5)
    np.testing.assert_array_equal(got, _oracle(X))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
