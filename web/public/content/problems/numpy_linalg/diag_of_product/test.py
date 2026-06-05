import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    n = A.shape[0]
    d = np.empty(n)
    for i in range(n):
        d[i] = A[i] @ B[:, i]
    return d


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    A = rng.standard_normal((6, 4))
    B = rng.standard_normal((4, 6))
    got = impl.diag_of_product(A, B)
    assert got.shape == (6,)
    np.testing.assert_allclose(got, _oracle(A, B), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
