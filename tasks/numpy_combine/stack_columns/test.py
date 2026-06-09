import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("k,n", [(3, 4), (1, 5), (4, 2), (2, 6)])
def test_stack_columns(impl, rng_for, seed, k, n):
    rng = rng_for(seed)
    arrays = [rng.standard_normal(n) for _ in range(k)]
    out = impl.stack_columns(arrays)
    assert out.shape == (n, k)
    # Oracle: place each input array into column j.
    expected = np.empty((n, k), dtype=arrays[0].dtype)
    for j in range(k):
        expected[:, j] = arrays[j]
    np.testing.assert_array_equal(out, expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
