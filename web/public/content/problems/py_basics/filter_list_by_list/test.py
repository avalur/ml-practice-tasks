import copy
import random

import pytest

from tools.checks import assert_clean

CASES = [
    ([], [], []),
    ([1, 2, 3], [], [1, 2, 3]),
    ([], [1, 2, 3], []),
    ([1], [1], []),
    ([1, 1], [1], []),
    ([1, 2], [3, 4], [1, 2]),
    ([2, 3], [1, 2], [3]),
    ([1, 1], [1, 1], []),
    ([1, 2], [1, 1], [2]),
    ([1, 4], [4, 4], [1]),
    ([2, 3], [1, 4], [2, 3]),
]


@pytest.mark.parametrize("a, b, expected", CASES)
def test_cases(impl, a, b, expected):
    a0, b0 = copy.deepcopy(a), copy.deepcopy(b)
    assert impl.filter_list_by_list(a, b) == expected
    assert a == a0 and b == b0, "You shouldn't change the inputs"


def test_matches_set_oracle(impl):
    # Independent oracle via a set (banned in the solution, fine in tests).
    rng = random.Random(0)
    a = sorted(rng.randint(0, 30) for _ in range(200))
    b = sorted(rng.randint(0, 30) for _ in range(200))
    bset = set(b)
    assert impl.filter_list_by_list(a, b) == [x for x in a if x not in bset]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
