import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    out = x.copy()
    for i in range(len(x)):
        if lo < x[i] < hi:
            out[i] = -x[i]
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal(20)
    lo, hi = -0.5, 0.5
    original = x.copy()
    got = impl.mask_negate(x, lo, hi)
    np.testing.assert_array_equal(got, _oracle(x, lo, hi))
    np.testing.assert_array_equal(x, original)  # must not mutate input


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
