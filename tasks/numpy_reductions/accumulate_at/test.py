import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(values: np.ndarray, idx: np.ndarray, n: int) -> np.ndarray:
    out = np.zeros(n)
    for v, k in zip(values.tolist(), idx.tolist()):
        out[k] += v
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    n = 5
    idx = rng.integers(0, n, size=12)
    values = rng.standard_normal(12)
    got = impl.accumulate_at(values, idx, n)
    assert got.shape == (n,)
    np.testing.assert_allclose(got, _oracle(values, idx, n), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
