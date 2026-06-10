import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean


def test_make_dataframe_basic(impl):
    cols = {"name": ["Alice", "Bob"], "age": [25, 30]}
    result = impl.make_dataframe(cols)
    expected = pd.DataFrame(cols)
    assert_frame_equal(result, expected)


def test_make_dataframe_column_order(impl):
    cols = {"z": [1, 2], "a": [3, 4], "m": [5, 6]}
    result = impl.make_dataframe(cols)
    assert list(result.columns) == ["z", "a", "m"]


def test_make_dataframe_single_column(impl):
    cols = {"v": [10, 20, 30]}
    result = impl.make_dataframe(cols)
    assert list(result["v"]) == [10, 20, 30]


@pytest.mark.parametrize("a, b, result_col", [
    ([2, 3, 4], [10, 20, 30], "product"),
    ([1, 2], [1, 2], "square"),
    ([0, 5], [100, 3], "out"),
])
def test_add_product_column(impl, a, b, result_col):
    df = pd.DataFrame({"a": a, "b": b})
    out = impl.add_product_column(df, "a", "b", result_col)
    assert list(out[result_col]) == [x * y for x, y in zip(a, b)]
    assert result_col not in df.columns, "original df must not be mutated"
    assert list(out["a"]) == a
    assert list(out["b"]) == b


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
