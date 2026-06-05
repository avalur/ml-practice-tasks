import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(A: np.ndarray) -> np.ndarray:
    lead = A.shape[:-2]
    out = np.zeros(lead)
    for idx in np.ndindex(*lead):
        out[idx] = A[idx].sum()
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    A = rng.standard_normal((2, 3, 4, 5))
    got = impl.sum_last_two(A)
    assert got.shape == (2, 3)
    np.testing.assert_allclose(got, _oracle(A), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
