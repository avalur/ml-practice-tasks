import pytest

from tools.checks import assert_clean

CASES = [[], [1, 2, 3], [1, 2, 1], [1, 2, 3, 4], [1], [2, 2, 2, 2], [5, 4, 3, 2, 1]]


@pytest.mark.parametrize("lst", CASES)
def test_reverse(impl, lst):
    original = list(lst)
    # Independent oracle: slicing is allowed in trusted test code.
    assert impl.reverse_iterative(lst) == lst[::-1]
    assert lst == original, "You shouldn't change the input"


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
