import numpy as np
import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_solution_satisfies_system(impl, rng_for, seed):
    rng = rng_for(seed)
    n = 4
    # Make A well-conditioned (diagonally boosted) so it is invertible.
    A = rng.standard_normal((n, n)) + n * np.eye(n)
    b = rng.standard_normal(n)
    x = impl.solve_system(A, b)
    assert x.shape == (n,)
    # The defining property: A @ x == b.
    np.testing.assert_allclose(A @ x, b, rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
