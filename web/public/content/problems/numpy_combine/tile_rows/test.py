import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("r,n", [(3, 4), (1, 5), (4, 1), (2, 6)])
def test_tile_rows(impl, rng_for, seed, r, n):
    rng = rng_for(seed)
    x = rng.standard_normal(n)
    out = impl.tile_rows(x, r)
    assert out.shape == (r, n)
    # Oracle: every row must equal x.
    expected = np.empty((r, n), dtype=x.dtype)
    for i in range(r):
        expected[i] = x
    np.testing.assert_array_equal(out, expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
