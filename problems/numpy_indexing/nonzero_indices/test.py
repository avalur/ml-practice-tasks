import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray) -> np.ndarray:
    return np.array([i for i in range(len(x)) if x[i] != 0], dtype=int)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.integers(0, 3, size=12)  # contains zeros
    np.testing.assert_array_equal(impl.nonzero_indices(x), _oracle(x))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
