import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray) -> np.ndarray:
    out = x.copy()
    arg = 0
    for i in range(len(x)):
        if x[i] > x[arg]:
            arg = i
    out[arg] = 0
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal(10)
    original = x.copy()
    got = impl.replace_max(x)
    np.testing.assert_array_equal(got, _oracle(x))
    np.testing.assert_array_equal(x, original)  # must not mutate input


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
