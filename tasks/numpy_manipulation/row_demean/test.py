import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray) -> np.ndarray:
    out = X.astype(float).copy()
    for i in range(X.shape[0]):
        out[i] = X[i] - X[i].mean()
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((6, 4))
    got = impl.row_demean(X)
    assert got.shape == X.shape
    np.testing.assert_allclose(got, _oracle(X), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
