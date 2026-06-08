import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
@pytest.mark.parametrize("m,k,n", [(5, 3, 2), (1, 1, 1), (4, 4, 4), (2, 5, 3)])
def test_matrix_product(impl, rng_for, seed, m, k, n):
    rng = rng_for(seed)
    a = rng.standard_normal((m, k))
    b = rng.standard_normal((k, n))
    out = impl.matrix_product(a, b)
    # Oracle: the same product spelled with einsum, independent of @ / np.dot.
    expected = np.einsum("ik,kj->ij", a, b)
    assert out.shape == (m, n)
    np.testing.assert_allclose(out, expected, rtol=1e-12, atol=1e-12)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
