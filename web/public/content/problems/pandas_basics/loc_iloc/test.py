import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean

DF_LABELED = pd.DataFrame(
    {"A": [1, 2, 3], "B": [4, 5, 6], "C": [7, 8, 9]},
    index=["r1", "r2", "r3"],
)


@pytest.mark.parametrize("rows, cols", [
    (["r1", "r3"], ["A", "C"]),
    (["r2"], ["B"]),
    (["r1", "r2", "r3"], ["A", "B", "C"]),
    (["r3", "r1"], ["C", "A"]),
])
def test_loc_select(impl, rows, cols):
    result = impl.loc_select(DF_LABELED, rows, cols)
    expected = DF_LABELED.loc[rows, cols]
    assert_frame_equal(result, expected)


DF_POS = pd.DataFrame(
    {"X": [10, 20, 30, 40], "Y": [1, 2, 3, 4], "Z": [5, 6, 7, 8]},
)


@pytest.mark.parametrize("rows, cols", [
    ([0, 2], [0, 2]),
    ([1, 3], [1]),
    ([0, 1, 2, 3], [0, 1, 2]),
    ([3, 0], [2, 0]),
])
def test_iloc_select(impl, rows, cols):
    result = impl.iloc_select(DF_POS, rows, cols)
    expected = DF_POS.iloc[rows, cols]
    assert_frame_equal(result, expected)


def test_loc_returns_correct_index(impl):
    result = impl.loc_select(DF_LABELED, ["r3", "r1"], ["B"])
    assert list(result.index) == ["r3", "r1"]
    assert list(result.columns) == ["B"]


def test_iloc_returns_correct_position(impl):
    result = impl.iloc_select(DF_POS, [3, 0], [2, 0])
    assert list(result["X"]) == [40, 10]
    assert list(result["Z"]) == [8, 5]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
