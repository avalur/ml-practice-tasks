import copy

import pytest

from tools.checks import assert_clean

# (dct, expected inverted) — ground truth (lists compared order-independently).
CASES = [
    ({}, {}),
    ({"a": "1"}, {"1": ["a"]}),
    ({"": "1", "a": ""}, {"1": [""], "": ["a"]}),
    ({"a": "1", "b": "2", "c": "1"}, {"1": ["a", "c"], "2": ["b"]}),
    ({"a": "1", "b": "2", "c": "1", "d": "1", "e": "2", "g": "3"},
     {"1": ["a", "c", "d"], "2": ["b", "e"], "3": ["g"]}),
    ({"": "1", "a": "", "b": ""}, {"1": [""], "": ["a", "b"]}),
]


@pytest.mark.parametrize("dct, expected", CASES)
def test_revert(impl, dct, expected):
    given = copy.deepcopy(dct)
    answer = impl.revert(given)
    assert given == dct, "You shouldn't change the input"
    assert isinstance(answer, dict)
    norm = {k: sorted(v) for k, v in answer.items()}
    assert norm == {k: sorted(v) for k, v in expected.items()}


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
