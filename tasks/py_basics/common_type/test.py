import pytest

from tools.checks import assert_clean

# (value1, value2, expected common type) — ground-truth calibration table.
CASES = [
    ("[1,2,3]", [3, 4, 5], str),
    ("1.3", 1.3, str),
    ("Hello", False, str),
    ([1, 2, 3], [3, 4, 5], list),
    ([1, 2, 3], (1, 2, 3), list),
    ([1, 2, 3], range(3), list),
    ([1, 2, 3], 2, str),
    ([1, 2, 3], True, str),
    ((1, 2, 3), (3, 4, 5), tuple),
    ((1, 2, 3), range(3), tuple),
    ((1, 2, 3), 2, str),
    ((1, 2, 3), False, str),
    (range(3), range(3), tuple),
    (range(3), 1, str),
    (range(3), False, str),
    (True, False, bool),
    (True, 2, int),
    (True, 1.5, float),
    (True, 2j, complex),
    (1.0, 2, float),
    (1.0, 2j, complex),
    (1, 2, int),
    (1, 2j, complex),
    (1j, 2j, complex),
]


@pytest.mark.parametrize("v1, v2, expected", CASES)
def test_common_type(impl, v1, v2, expected):
    t1, t2 = type(v1), type(v2)
    got = impl.get_common_type(t1, t2)
    assert got is expected
    # symmetric in its arguments
    assert impl.get_common_type(t2, t1) is expected
    # the returned type can actually convert both values
    got(v1)
    got(v2)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
