import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_make_immutable(impl, rng_for, seed):
    rng = rng_for(seed)
    a = rng.standard_normal(10)
    expected = a.copy()  # snapshot the values before freezing
    out = impl.make_immutable(a)
    # Same values, but the result must now be read-only.
    np.testing.assert_array_equal(out, expected)
    assert out.flags.writeable is False
    with pytest.raises(ValueError):
        out[0] = 123.0


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
