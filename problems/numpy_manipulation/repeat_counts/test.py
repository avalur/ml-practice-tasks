import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(counts: np.ndarray) -> np.ndarray:
    out = []
    for i in range(len(counts)):
        for _ in range(int(counts[i])):
            out.append(i)
    return np.array(out, dtype=int)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    counts = rng.integers(0, 4, size=6)
    np.testing.assert_array_equal(impl.repeat_counts(counts), _oracle(counts))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
