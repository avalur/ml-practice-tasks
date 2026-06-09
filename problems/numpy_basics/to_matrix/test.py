import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("rows,cols", [(3, 4), (1, 7), (6, 1), (2, 5)])
def test_to_matrix(impl, rng_for, seed, rows, cols):
    rng = rng_for(seed)
    x = rng.standard_normal(rows * cols)
    out = impl.to_matrix(x, rows)
    assert out.shape == (rows, cols)
    # Oracle: fill a (rows, cols) array in C (row-major) order by hand.
    expected = np.empty((rows, cols), dtype=x.dtype)
    for i in range(rows):
        for j in range(cols):
            expected[i, j] = x[i * cols + j]
    np.testing.assert_array_equal(out, expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
