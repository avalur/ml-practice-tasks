import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(x: np.ndarray) -> int:
    counts = {}
    for v in x.tolist():
        counts[v] = counts.get(v, 0) + 1
    best_v, best_c = -1, -1
    for v in sorted(counts):  # ascending → ties resolve to the smallest value
        if counts[v] > best_c:
            best_v, best_c = v, counts[v]
    return best_v


@pytest.mark.parametrize("seed", [0, 1, 2, 3])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    x = rng.integers(0, 5, size=15)
    assert int(impl.most_frequent(x)) == _oracle(x)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
