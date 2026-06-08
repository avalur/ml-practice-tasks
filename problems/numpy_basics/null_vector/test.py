import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("n", [0, 1, 5, 10, 37])
def test_null_vector(impl, n):
    out = impl.null_vector(n)
    expected = np.zeros(n)
    assert out.shape == (n,)
    np.testing.assert_array_equal(out, expected)
    assert out.dtype == expected.dtype  # float64


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
