import pytest

from tools.checks import assert_clean

# range(0, STOP, 2) has 10**9 elements — huge enough that a linear scan blows the
# watchdog, but < 2**31 so len() fits the 32-bit size type of the WASM/Pyodide build.
STOP = 2 * 10**9

# (nums, value, expected) — small cases checked against the `in` oracle too.
CASES = [
    ([], 2, False),
    ([1], 2, False),
    ([1, 3, 5], 0, False),
    ([1, 3, 5], 2, False),
    ([1, 3, 5], 6, False),
    ([1, 3, 5], 1, True),
    ([1, 3, 5], 3, True),
    ([1, 3, 5], 5, True),
    ([1, 3, 5, 7], 4, False),
    ([1, 3, 5, 7], 7, True),
    ([1, 5, 5, 5, 9], 5, True),
    ([1, 5, 5, 5, 9], 7, False),
]


@pytest.mark.parametrize("nums, value, expected", CASES)
def test_small(impl, nums, value, expected):
    original = list(nums)
    got = impl.find_value(nums, value)
    assert got == expected
    # Independent oracle: membership is allowed in trusted test code.
    assert got == (value in nums)
    assert nums == original, "You shouldn't change the input"


@pytest.mark.parametrize(
    "value, expected",
    [(STOP - 2, True), (0, True), (STOP, False), (-1, False),
     (STOP // 2, True), (STOP // 2 + 1, False)],
)
def test_big_range_needs_log_n(impl, value, expected):
    # A billion evens — only a logarithmic search returns before the watchdog.
    assert impl.find_value(range(0, STOP, 2), value) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
