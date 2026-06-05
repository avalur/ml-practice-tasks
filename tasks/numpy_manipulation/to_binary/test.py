import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray, bits: int) -> np.ndarray:
    out = np.zeros((len(x), bits), dtype=int)
    for i, v in enumerate(x.tolist()):
        for b in range(bits):
            out[i, bits - 1 - b] = (v >> b) & 1
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    bits = 5
    x = rng.integers(0, 2 ** bits, size=7)
    got = impl.to_binary(x, bits)
    assert got.shape == (7, bits)
    np.testing.assert_array_equal(got, _oracle(x, bits))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
