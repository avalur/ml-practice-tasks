import numpy as np

from tools.checks import assert_clean


def test_returns_numpy_version(impl):
    v = impl.numpy_version()
    assert isinstance(v, str)
    assert v == np.__version__


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
