import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(z: np.ndarray, nz: int) -> np.ndarray:
    out = []
    vals = z.tolist()
    for i, v in enumerate(vals):
        out.append(v)
        if i != len(vals) - 1:
            out.extend([0] * nz)
    return np.array(out, dtype=z.dtype)


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("nz", [1, 2, 3])
def test_matches_oracle(impl, rng_for, seed, nz):
    rng = rng_for(seed)
    z = rng.integers(1, 9, size=5)
    np.testing.assert_array_equal(impl.interleave_zeros(z, nz), _oracle(z, nz))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
