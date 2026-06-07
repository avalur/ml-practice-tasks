import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray) -> np.ndarray:
    flat = x.reshape(-1).tolist()
    n = len(flat)
    mean = sum(flat) / n
    var = sum((v - mean) ** 2 for v in flat) / n
    return (x - mean) / (var ** 0.5)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.standard_normal((4, 5)) * 3 + 7
    np.testing.assert_allclose(impl.normalize(x), _oracle(x), rtol=1e-6, atol=1e-9)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
