import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(n: int) -> np.ndarray:
    out = np.zeros((n, n), dtype=int)
    for i in range(n):
        for j in range(n):
            out[i, j] = (i + j) % 2
    return out


@pytest.mark.parametrize("n", [1, 2, 4, 5])
def test_matches_oracle(impl, n):
    got = impl.checkerboard(n)
    assert got.shape == (n, n)
    np.testing.assert_array_equal(got, _oracle(n))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
