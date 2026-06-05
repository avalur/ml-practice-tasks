import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray) -> np.ndarray:
    out = np.empty_like(x)
    n = len(x)
    for i in range(n):
        out[i] = x[n - 1 - i]
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_reverses(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal(9)
    np.testing.assert_array_equal(impl.reverse_vector(x), _oracle(x))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
