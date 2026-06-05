import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray, v: float):
    best, best_d = x[0], abs(x[0] - v)
    for val in x.tolist():
        d = abs(val - v)
        if d < best_d:
            best, best_d = val, d
    return best


@pytest.mark.parametrize("seed", [0, 1, 2, 3])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal(11)
    v = float(rng.standard_normal())
    assert impl.closest_value(x, v) == _oracle(x, v)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
