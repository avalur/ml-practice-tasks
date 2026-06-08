import numpy as np

from tools.checks import assert_clean


def test_rgba_dtype(impl):
    dt = impl.rgba_dtype()
    assert isinstance(dt, np.dtype)
    assert dt.names == ("r", "g", "b", "a")
    for name in ("r", "g", "b", "a"):
        assert dt[name] == np.uint8
    assert dt.itemsize == 4  # four 1-byte fields


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
