import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(a: np.ndarray, n: int) -> np.ndarray:
    return np.array([a[i : i + n].mean() for i in range(len(a) - n + 1)])


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n", [1, 2, 3, 5])
def test_matches_oracle(impl, rng_for, seed, n):
    rng = rng_for(seed)
    a = rng.standard_normal(12)
    got = impl.moving_average(a, n)
    assert got.shape == (len(a) - n + 1,)
    np.testing.assert_allclose(got, _oracle(a, n), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
