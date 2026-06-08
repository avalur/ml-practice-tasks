import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("n", [30, 1, 7, 100])
def test_vector_mean(impl, rng_for, seed, n):
    rng = rng_for(seed)
    x = rng.standard_normal(n)
    # Oracle: np.average (no weights) is the mean, computed via a different API.
    np.testing.assert_allclose(impl.vector_mean(x), np.average(x), rtol=1e-12, atol=1e-12)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
