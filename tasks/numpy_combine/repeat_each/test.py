import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n,k", [(4, 2), (5, 1), (1, 3), (3, 4)])
def test_repeat_each(impl, rng_for, seed, n, k):
    rng = rng_for(seed)
    x = rng.standard_normal(n)
    out = impl.repeat_each(x, k)
    assert out.shape == (n * k,)
    # Oracle: build [x0,x0,...,x1,x1,...] explicitly.
    expected = []
    for v in x:
        for _ in range(k):
            expected.append(v)
    np.testing.assert_array_equal(out, np.array(expected))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
