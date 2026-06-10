import copy

import pytest

from tools.checks import assert_clean

# (nested dict, expected (dotted_key, value) pairs) — order-independent.
CASES = [
    ({}, []),
    ({"a": 1}, [("a", 1)]),
    ({"a": 1, "b": 2}, [("a", 1), ("b", 2)]),
    ({"a": 1, "b": 2, "c": {"d": 3}}, [("a", 1), ("b", 2), ("c.d", 3)]),
    ({"a": 1, "c": {"d": 3, "e": {"g": 7}}, "f": 5},
     [("a", 1), ("c.d", 3), ("c.e.g", 7), ("f", 5)]),
    ({"a": {"b": {"c": {"d": {"e": 1}}}}}, [("a.b.c.d.e", 1)]),
]


@pytest.mark.parametrize("dct, expected", CASES)
def test_immutable(impl, dct, expected):
    given = copy.deepcopy(dct)
    assert sorted(impl.traverse_dictionary_immutable(dct)) == sorted(expected)
    assert dct == given, "You shouldn't change the input"


@pytest.mark.parametrize("dct, expected", CASES)
def test_mutable(impl, dct, expected):
    given = copy.deepcopy(dct)
    result: list = []
    impl.traverse_dictionary_mutable(dct, result)
    assert sorted(result) == sorted(expected)
    assert dct == given, "You shouldn't change the input"


@pytest.mark.parametrize("dct, expected", CASES)
def test_iterative(impl, dct, expected):
    assert sorted(impl.traverse_dictionary_iterative(dct)) == sorted(expected)


def test_iterative_deep(impl):
    # A 5000-level chain: a recursive solution would hit the recursion limit.
    n = 5000
    dct: dict = {}
    node = dct
    keys = []
    for i in range(n):
        k = str(i)
        node[k] = {}
        node = node[k]
        keys.append(k)
    node["leaf"] = 42
    keys.append("leaf")
    assert impl.traverse_dictionary_iterative(dct) == [(".".join(keys), 42)]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
