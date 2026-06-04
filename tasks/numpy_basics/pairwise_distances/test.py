import numpy as np
import pytest

from tools.checks import assert_clean


def _bruteforce(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Trusted ground truth (test code, so loops are fine here)."""
    out = np.empty((x.shape[0], y.shape[0]))
    for i in range(x.shape[0]):
        for j in range(y.shape[0]):
            out[i, j] = np.sqrt(((x[i] - y[j]) ** 2).sum())
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_bruteforce(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal((7, 4))
    y = rng.standard_normal((5, 4))
    got = impl.pairwise_distances(x, y)
    assert got.shape == (7, 5)
    np.testing.assert_allclose(got, _bruteforce(x, y), rtol=1e-6, atol=1e-9)


def test_single_point(impl, rng_for):
    rng = rng_for(0)
    x = rng.standard_normal((1, 3))
    np.testing.assert_allclose(impl.pairwise_distances(x, x), [[0.0]], atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
