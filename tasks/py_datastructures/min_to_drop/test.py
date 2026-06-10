import copy

import pytest

from tools.checks import assert_clean

CASES = [
    ([], 0),
    ([1, 2, 3, 1], 2),
    ([1, 2, 1], 1),
    ([1, 1], 0),
    ([1], 0),
    (["a", "a", "b", "c"], 2),
    ([1, 2, 3, 4], 3),
    ([1, 1, 1, 2, 2, 2, 2], 3),
    ([1, 1, 2, 2, 3, 3], 4),
    ([-1, 1, 1, -1, 3, 3, -1], 4),
    ([-1, 1] * 1024, 1024),
    (list(range(1024)), 1023),
]


@pytest.mark.parametrize("seq, expected", CASES)
def test_min_to_drop(impl, seq, expected):
    given = copy.deepcopy(seq)
    assert impl.get_min_to_drop(seq) == expected
    assert seq == given, "You shouldn't change the input"


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
