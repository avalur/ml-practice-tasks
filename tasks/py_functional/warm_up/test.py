from types import GeneratorType

import pytest

from tools.checks import assert_clean


@pytest.mark.parametrize("matrix, expected", [
    ([[1, 2], [3, 4], [5, 6]], [[1, 3, 5], [2, 4, 6]]),
    ([[1, 2], [3, 4]], [[1, 3], [2, 4]]),
    ([[1], [3]], [[1, 3]]),
    ([[1, 3]], [[1], [3]]),
    ([[1]], [[1]]),
])
def test_transpose(impl, matrix, expected):
    assert impl.transpose(matrix) == expected


@pytest.mark.parametrize("seq, expected", [
    ([1, 2, 3, 3, 1, 7], [1, 2, 3, 7]),
    ([1, 1, 3, 1, 1, 3], [1, 3]),
    ([1], [1]),
    ([], []),
])
def test_uniq(impl, seq, expected):
    gen = impl.uniq(seq)
    assert isinstance(gen, GeneratorType), "uniq must be a generator"
    assert list(gen) == expected


@pytest.mark.parametrize("dicts, expected", [
    ([{1: 2}, {2: 2}, {1: 1}], {1: 1, 2: 2}),
    ([{1: 2}, {1: 3}, {1: 1}], {1: 1}),
    ([{1: 2}, {2: 3}, {3: 4}], {1: 2, 2: 3, 3: 4}),
    ([{}, {}, {3: 4}], {3: 4}),
])
def test_dict_merge(impl, dicts, expected):
    assert impl.dict_merge(*dicts) == expected


@pytest.mark.parametrize("left, right, expected", [
    ([1, 2, 3], [4, 5, 6], 32),
    ([1, 2], [3, 4], 11),
    ([1], [1], 1),
])
def test_product(impl, left, right, expected):
    assert impl.product(left, right) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
