import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("n,i", [(10, 4), (1, 0), (5, 0), (5, 4), (8, 3)])
def test_null_with_one(impl, n, i):
    out = impl.null_with_one(n, i)
    expected = np.zeros(n)
    expected[i] = 1
    assert out.shape == (n,)
    np.testing.assert_array_equal(out, expected)
    assert out.dtype == expected.dtype


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
