import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    n, m = len(x), len(y)
    C = np.empty((n, m))
    for i in range(n):
        for j in range(m):
            C[i, j] = 1.0 / (x[i] - y[j])
    return C


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal(5)
    y = rng.standard_normal(6) + 100.0  # disjoint from x → no division by zero
    got = impl.cauchy(x, y)
    assert got.shape == (5, 6)
    np.testing.assert_allclose(got, _oracle(x, y), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
