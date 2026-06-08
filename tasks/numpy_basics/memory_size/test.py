import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("dtype", [np.float64, np.float32, np.int32, np.int8])
def test_memory_size(impl, rng_for, seed, dtype):
    rng = rng_for(seed)
    ndim = int(rng.integers(1, 4))
    shape = tuple(int(v) for v in rng.integers(1, 6, size=ndim))
    a = rng.integers(0, 10, size=shape).astype(dtype)
    # Oracle: NumPy's own byte count, computed independently of size * itemsize.
    assert impl.memory_size(a) == a.nbytes


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
