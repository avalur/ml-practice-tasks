import copy
import itertools
import random

import pytest

from tools.checks import assert_clean


def _oracle(lists):
    # Independent: concatenate everything and sort (both banned in the solution).
    return sorted(itertools.chain.from_iterable(lists))


EXPLICIT = [
    [],
    [[]],
    [[], [], []],
    [[1], [1]],
    [[1, 4, 7], [2, 3, 8], [0, 5, 9]],
    [[1, 2, 3]],
    [list(range(0, 100, 2)), list(range(1, 100, 2))],
]


@pytest.mark.parametrize("lists", EXPLICIT)
def test_explicit(impl, lists):
    given = copy.deepcopy(lists)
    assert impl.merge(lists) == _oracle(lists)
    assert lists == given, "You shouldn't change the inputs"


def test_fuzz(impl):
    rng = random.Random(3)
    for _ in range(50):
        k = rng.randint(0, 6)
        lists = [sorted(rng.randint(-20, 20) for _ in range(rng.randint(0, 12))) for _ in range(k)]
        assert impl.merge(lists) == _oracle(lists)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
