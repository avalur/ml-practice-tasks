import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray, n: int) -> np.ndarray:
    return np.array(sorted(x.tolist(), reverse=True)[:n])


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n", [1, 3, 5])
def test_matches_oracle(impl, rng_for, seed, n):
    rng = rng_for(seed)
    x = rng.standard_normal(12)
    got = impl.n_largest(x, n)
    assert got.shape == (n,)
    np.testing.assert_allclose(got, _oracle(x, n), rtol=1e-9, atol=1e-12)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
