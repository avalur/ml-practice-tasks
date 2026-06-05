import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray, b: int) -> np.ndarray:
    n = X.shape[0]
    out = np.zeros((n // b, n // b))
    for r in range(n // b):
        for c in range(n // b):
            out[r, c] = X[r * b:(r + 1) * b, c * b:(c + 1) * b].sum()
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("b", [2, 3])
def test_matches_oracle(impl, rng_for, seed, b):
    rng = rng_for(seed)
    X = rng.standard_normal((6, 6))
    got = impl.block_sum(X, b)
    assert got.shape == (6 // b, 6 // b)
    np.testing.assert_allclose(got, _oracle(X, b), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
