import numpy as np
import pytest

from tools.checks import assert_clean


def _oracle(X: np.ndarray) -> np.ndarray:
    seen = []
    for row in X.tolist():
        if row not in seen:
            seen.append(row)
    seen.sort()
    return np.array(seen, dtype=X.dtype)


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_matches_oracle(impl, rng_for, seed):
    rng = rng_for(seed)
    X = rng.integers(0, 3, size=(8, 3))  # many duplicate rows
    np.testing.assert_array_equal(impl.unique_rows(X), _oracle(X))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
