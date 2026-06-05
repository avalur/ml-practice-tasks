import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray) -> float:
    total = 0.0
    for i in range(X.shape[0]):
        total += X[i, i]
    return total


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.standard_normal((5, 5))
    np.testing.assert_allclose(impl.trace(X), _oracle(X), rtol=1e-9, atol=1e-12)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
