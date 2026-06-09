import random

import pytest

from tools.checks import assert_clean

CASES = [
    ([], []),
    ([1, 2, 3], []),
    ([], [1, 2, 3]),
    ([1], [1]),
    ([1, 2], [3, 4]),
    ([1, 3], [2, 4]),
    ([3, 4], [1, 2]),
    ([2, 3], [1, 2]),
    ([1, 1], [1, 1]),
    ([1, 2], [1, 1]),
    ([1, 4], [4, 4]),
]


@pytest.mark.parametrize("a, b", CASES)
def test_cases(impl, a, b):
    a0, b0 = list(a), list(b)
    # Independent oracle: sorting the concatenation is allowed in test code.
    assert impl.merge_iterative(a, b) == sorted(a + b)
    assert a == a0 and b == b0, "You shouldn't change the inputs"


def test_fuzz(impl):
    rng = random.Random(1)
    for _ in range(50):
        a = sorted(rng.randint(-10, 10) for _ in range(rng.randint(0, 15)))
        b = sorted(rng.randint(-10, 10) for _ in range(rng.randint(0, 15)))
        assert impl.merge_iterative(a, b) == sorted(a + b)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
