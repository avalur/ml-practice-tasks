import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("lengths", [[2, 1, 2], [5], [3, 3], [1, 4, 2, 1]])
def test_concat_arrays(impl, rng_for, seed, lengths):
    rng = rng_for(seed)
    arrays = [rng.standard_normal(n) for n in lengths]
    out = impl.concat_arrays(arrays)
    assert out.shape == (sum(lengths),)
    # Oracle: collect every element into a Python list, then make an array.
    flat = []
    for a in arrays:
        for v in a:
            flat.append(v)
    np.testing.assert_array_equal(out, np.array(flat))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
