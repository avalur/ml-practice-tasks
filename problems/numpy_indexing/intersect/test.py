import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    common = set(a.tolist()) & set(b.tolist())
    return np.array(sorted(common), dtype=a.dtype)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    a = rng.integers(0, 8, size=10)
    b = rng.integers(0, 8, size=10)
    np.testing.assert_array_equal(impl.intersect(a, b), _oracle(a, b))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
