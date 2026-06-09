import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n,part", [(3, 2), (1, 5), (5, 1), (2, 4)])
def test_split_equal(impl, rng_for, seed, n, part):
    rng = rng_for(seed)
    x = rng.standard_normal(n * part)
    out = impl.split_equal(x, n)
    assert len(out) == n
    # Oracle: slice out each contiguous block by hand.
    for i in range(n):
        np.testing.assert_array_equal(out[i], x[i * part:(i + 1) * part])


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
