import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n", [1, 4, 7, 10])
def test_to_column(impl, rng_for, seed, n):
    rng = rng_for(seed)
    x = rng.standard_normal(n)
    out = impl.to_column(x)
    assert out.shape == (n, 1)
    # Oracle: row i holds exactly x[i].
    for i in range(n):
        assert out[i, 0] == x[i]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
