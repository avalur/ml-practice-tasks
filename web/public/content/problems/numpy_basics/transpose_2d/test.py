import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("m,n", [(3, 4), (1, 5), (5, 1), (4, 4)])
def test_transpose_2d(impl, rng_for, seed, m, n):
    rng = rng_for(seed)
    X = rng.standard_normal((m, n))
    out = impl.transpose_2d(X)
    assert out.shape == (n, m)
    # Oracle: build the transpose element by element.
    expected = np.empty((n, m), dtype=X.dtype)
    for i in range(m):
        for j in range(n):
            expected[j, i] = X[i, j]
    np.testing.assert_array_equal(out, expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
