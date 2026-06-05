import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(labels: np.ndarray, k: int) -> np.ndarray:
    out = np.zeros((labels.shape[0], k))
    for i in range(labels.shape[0]):
        out[i, labels[i]] = 1.0
    return out


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    k = 5
    labels = rng.integers(0, k, size=8)
    got = impl.one_hot(labels, k)
    assert got.shape == (8, k)
    np.testing.assert_array_equal(got, _oracle(labels, k))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
