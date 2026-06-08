import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("lo,hi", [(10, 50), (0, 1), (0, 0), (-3, 4), (5, 5), (7, 20)])
def test_range_vector(impl, lo, hi):
    out = impl.range_vector(lo, hi)
    expected = np.arange(lo, hi)
    np.testing.assert_array_equal(out, expected)
    assert out.dtype == expected.dtype


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
