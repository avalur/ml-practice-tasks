import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("shape", [(3, 4), (2, 3, 2), (1, 5), (5,)])
def test_flatten(impl, rng_for, seed, shape):
    rng = rng_for(seed)
    X = rng.standard_normal(shape)
    out = impl.flatten(X)
    assert out.ndim == 1
    assert out.shape == (X.size,)
    # Oracle: walk X in C order with explicit multi-index iteration.
    expected = np.array([X[idx] for idx in np.ndindex(X.shape)])
    np.testing.assert_array_equal(out, expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
